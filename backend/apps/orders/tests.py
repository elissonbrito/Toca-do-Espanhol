from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.menu.models import MenuCategory, MenuItem
from apps.tables.models import Table, TableStatus
from .models import Order, OrderStatus, ItemStatus, ItemSector

User = get_user_model()


class OrderFlowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.garcom = User.objects.create_user(name='G', email='g@t.com', password='x', role='GARCOM')
        cls.cozinha = User.objects.create_user(name='C', email='c@t.com', password='x', role='COZINHA')
        cls.recep = User.objects.create_user(name='R', email='r@t.com', password='x', role='RECEPCAO')
        cls.caixa = User.objects.create_user(name='K', email='k@t.com', password='x', role='CAIXA')
        cls.table = Table.objects.create(number=1, seats=4)
        cat = MenuCategory.objects.create(name='Parrilla')
        cls.bife = MenuItem.objects.create(
            category=cat, name='Bife', sector=ItemSector.PARRILLA, price='25.00', sku='BIFE',
            ncm='02013000', cfop='5101', csosn='102', origem='0',
            unit_commercial='UN', unit_taxable='UN', pis_cst='49', cofins_cst='49',
        )

    def open_order(self, user=None):
        self.client.force_authenticate(user or self.garcom)
        return self.client.post('/api/orders/', {'table': self.table.id, 'people_count': 2}, format='json')

    def add_item(self, order_id, quantity=1, user=None):
        self.client.force_authenticate(user or self.garcom)
        return self.client.post(f'/api/orders/{order_id}/add_item/',
                                {'menu_item': self.bife.id, 'quantity': quantity}, format='json')

    def test_open_order_occupies_table(self):
        r = self.open_order()
        self.assertEqual(r.status_code, 201)
        self.table.refresh_from_db()
        self.assertEqual(self.table.status, TableStatus.OCUPADA)

    def test_cozinha_cannot_open_order(self):
        self.assertEqual(self.open_order(self.cozinha).status_code, 403)

    def test_recepcao_can_open_order(self):
        self.assertEqual(self.open_order(self.recep).status_code, 201)

    def test_duplicate_open_order_rejected(self):
        self.open_order()
        self.assertEqual(self.open_order().status_code, 400)

    def test_add_item_from_menu_recalculates_and_snapshots(self):
        order_id = self.open_order().data['id']
        r = self.add_item(order_id, quantity=2)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['product_name'], 'Bife')
        self.assertEqual(r.data['fiscal_ncm'], '02013000')
        self.assertEqual(str(Order.objects.get(pk=order_id).total_amount), '50.00')

    def test_free_text_item_is_rejected(self):
        order_id = self.open_order().data['id']
        r = self.client.post(f'/api/orders/{order_id}/add_item/',
                             {'product_name': 'Avulso', 'unit_price': '5.00', 'sector': 'BAR'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_any_authenticated_user_can_add_menu_item(self):
        order_id = self.open_order().data['id']
        self.assertEqual(self.add_item(order_id, user=self.cozinha).status_code, 201)

    def test_cannot_add_item_to_finalized_order(self):
        order_id = self.open_order().data['id']
        self.client.force_authenticate(self.caixa)
        self.client.post(f'/api/orders/{order_id}/update_status/', {'status': OrderStatus.FINALIZADO}, format='json')
        self.assertEqual(self.add_item(order_id).status_code, 400)

    def test_finalize_sends_table_to_cleaning(self):
        order_id = self.open_order().data['id']
        self.client.force_authenticate(self.caixa)
        r = self.client.post(f'/api/orders/{order_id}/update_status/', {'status': OrderStatus.FINALIZADO}, format='json')
        self.assertEqual(r.status_code, 200)
        self.table.refresh_from_db()
        self.assertEqual(self.table.status, TableStatus.LIMPEZA)

    def test_remove_item_cancels_and_recalculates(self):
        order_id = self.open_order().data['id']
        item_id = self.add_item(order_id, quantity=2).data['id']
        # Garçom não pode retirar item lançado — só o caixa.
        self.assertEqual(self.client.delete(f'/api/orders/{order_id}/items/{item_id}/').status_code, 403)
        self.client.force_authenticate(self.caixa)
        r = self.client.delete(f'/api/orders/{order_id}/items/{item_id}/')
        self.assertEqual(r.status_code, 200)
        order = Order.objects.get(pk=order_id)
        self.assertEqual(str(order.total_amount), '0.00')
        self.assertEqual(order.items.get(pk=item_id).status, ItemStatus.CANCELADO)

    # --- regras de segurança do update_status ---------------------------
    def test_garcom_cannot_finalize_without_cashier(self):
        order_id = self.open_order().data['id']
        r = self.client.post(f'/api/orders/{order_id}/update_status/',
                             {'status': OrderStatus.FINALIZADO}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(Order.objects.get(pk=order_id).status, OrderStatus.ABERTO)

    def test_garcom_cannot_reopen_finalized_order(self):
        order_id = self.open_order().data['id']
        self.client.force_authenticate(self.caixa)
        self.client.post(f'/api/orders/{order_id}/update_status/',
                         {'status': OrderStatus.FINALIZADO}, format='json')
        self.client.force_authenticate(self.garcom)
        r = self.client.post(f'/api/orders/{order_id}/update_status/',
                             {'status': OrderStatus.ABERTO}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_cozinha_cannot_cancel_order(self):
        order_id = self.open_order().data['id']
        self.client.force_authenticate(self.cozinha)
        r = self.client.post(f'/api/orders/{order_id}/update_status/',
                             {'status': OrderStatus.CANCELADO}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_fechamento_only_via_close_bill(self):
        order_id = self.open_order().data['id']
        r = self.client.post(f'/api/orders/{order_id}/update_status/',
                             {'status': OrderStatus.FECHAMENTO}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_invalid_status_rejected(self):
        order_id = self.open_order().data['id']
        r = self.client.post(f'/api/orders/{order_id}/update_status/',
                             {'status': "'; DROP TABLE orders_order; --"}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_quantity_must_be_positive(self):
        order_id = self.open_order().data['id']
        for qty in (0, -3):
            r = self.client.post(f'/api/orders/{order_id}/add_item/',
                                 {'menu_item': self.bife.id, 'quantity': qty}, format='json')
            self.assertEqual(r.status_code, 400, qty)
        self.assertEqual(str(Order.objects.get(pk=order_id).total_amount), '0.00')


class TransferTests(APITestCase):
    """Troca de mesa e transferência de itens (mexem no valor das contas)."""

    @classmethod
    def setUpTestData(cls):
        cls.garcom = User.objects.create_user(name='G', email='g@t.com', password='x', role='GARCOM')
        cls.caixa = User.objects.create_user(name='K', email='k@t.com', password='x', role='CAIXA')
        cls.t1 = Table.objects.create(number=1, seats=4)
        cls.t2 = Table.objects.create(number=2, seats=4)
        cat = MenuCategory.objects.create(name='Parrilla')
        cls.bife = MenuItem.objects.create(
            category=cat, name='Bife', sector=ItemSector.PARRILLA, price='25.00', sku='BIFE',
            ncm='02013000', cfop='5101', csosn='102', origem='0',
            unit_commercial='UN', unit_taxable='UN', pis_cst='49', cofins_cst='49',
        )

    def _order_with_item(self, table, qty=1):
        self.client.force_authenticate(self.garcom)
        oid = self.client.post('/api/orders/', {'table': table.id}, format='json').data['id']
        iid = self.client.post(f'/api/orders/{oid}/add_item/',
                               {'menu_item': self.bife.id, 'quantity': qty}, format='json').data['id']
        return oid, iid

    def test_transfer_table_moves_order_and_frees_old_table(self):
        oid, _ = self._order_with_item(self.t1)
        self.client.force_authenticate(self.caixa)
        r = self.client.post(f'/api/orders/{oid}/transfer-table/', {'table': self.t2.id}, format='json')
        self.assertEqual(r.status_code, 200)
        self.t1.refresh_from_db(); self.t2.refresh_from_db()
        self.assertEqual(self.t1.status, TableStatus.LIMPEZA)
        self.assertEqual(self.t2.status, TableStatus.OCUPADA)

    def test_transfer_table_to_busy_table_rejected(self):
        oid, _ = self._order_with_item(self.t1)
        self._order_with_item(self.t2)
        self.client.force_authenticate(self.caixa)
        r = self.client.post(f'/api/orders/{oid}/transfer-table/', {'table': self.t2.id}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_transfer_items_recalculates_both_orders(self):
        src, item = self._order_with_item(self.t1, qty=2)
        dst, _ = self._order_with_item(self.t2, qty=1)
        self.client.force_authenticate(self.caixa)
        r = self.client.post(f'/api/orders/{src}/transfer-items/',
                             {'target_order': dst, 'items': [item]}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(str(Order.objects.get(pk=src).total_amount), '0.00')
        self.assertEqual(str(Order.objects.get(pk=dst).total_amount), '75.00')

    def test_cannot_take_items_from_finalized_order(self):
        src, item = self._order_with_item(self.t1)
        dst, _ = self._order_with_item(self.t2)
        self.client.force_authenticate(self.caixa)
        self.client.post(f'/api/orders/{src}/update_status/', {'status': OrderStatus.FINALIZADO}, format='json')
        r = self.client.post(f'/api/orders/{src}/transfer-items/',
                             {'target_order': dst, 'items': [item]}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(str(Order.objects.get(pk=src).total_amount), '25.00')

    def test_transfer_items_bad_payload_is_400_not_500(self):
        src, _ = self._order_with_item(self.t1)
        dst, _ = self._order_with_item(self.t2)
        self.client.force_authenticate(self.caixa)
        for bad in ('abc', ['x'], None, {'a': 1}):
            r = self.client.post(f'/api/orders/{src}/transfer-items/',
                                 {'target_order': dst, 'items': bad}, format='json')
            self.assertEqual(r.status_code, 400, bad)

    def test_cannot_steal_items_from_another_order(self):
        """Item de uma terceira comanda não pode ser puxado via id forjado."""
        src, _ = self._order_with_item(self.t1)
        dst, _ = self._order_with_item(self.t2)
        t3 = Table.objects.create(number=3, seats=2)
        _, foreign_item = self._order_with_item(t3)
        self.client.force_authenticate(self.caixa)
        r = self.client.post(f'/api/orders/{src}/transfer-items/',
                             {'target_order': dst, 'items': [foreign_item]}, format='json')
        self.assertEqual(r.status_code, 400)


class BadIdTests(APITestCase):
    """Ids inválidos vindos do cliente viram 400/404 — nunca erro 500."""

    @classmethod
    def setUpTestData(cls):
        cls.caixa = User.objects.create_user(name='K', email='k@t.com', password='x', role='CAIXA')
        cls.recep = User.objects.create_user(name='R', email='r@t.com', password='x', role='RECEPCAO')
        cls.table = Table.objects.create(number=1, seats=4)
        cls.order = Order.objects.create(table=cls.table, opened_by=cls.caixa)

    def test_bad_ids(self):
        self.client.force_authenticate(self.caixa)
        oid = self.order.id
        for bad in ('abc', None, True, -1, 1.5, [1], {'a': 1}):
            with self.subTest(bad=bad):
                r = self.client.post(f'/api/orders/{oid}/transfer-table/', {'table': bad}, format='json')
                self.assertEqual(r.status_code, 400)
                r = self.client.post(f'/api/orders/{oid}/transfer-items/', {'target_order': bad}, format='json')
                self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.delete(f'/api/orders/{oid}/items/abc/').status_code, 404)
        self.assertEqual(self.client.get('/api/orders/abc/').status_code, 404)

    def test_bad_table_on_queue_assign(self):
        self.client.force_authenticate(self.recep)
        tid = self.client.post('/api/queue/', {'customer_name': 'X', 'people_count': 2}, format='json').data['id']
        r = self.client.post(f'/api/queue/{tid}/assign-table/', {'table': 'abc'}, format='json')
        self.assertEqual(r.status_code, 400)


class NonObjectBodyTests(APITestCase):
    """Corpo JSON que não é objeto ([], "x", 1, null) -> 400, nunca 500."""

    @classmethod
    def setUpTestData(cls):
        cls.adm = User.objects.create_user(name='A', email='a@t.com', password='x', role='ADM_MAXIMO')
        cls.table = Table.objects.create(number=1, seats=4)
        cls.order = Order.objects.create(table=cls.table, opened_by=cls.adm)

    def test_non_object_bodies(self):
        self.client.force_authenticate(self.adm)
        o, t = self.order.id, self.table.id
        paths = [f'/api/orders/{o}/update_status/', f'/api/orders/{o}/transfer-table/',
                 f'/api/orders/{o}/transfer-items/', '/api/queue/call_next/', f'/api/tables/{t}/status/']
        for path in paths:
            for raw in ('[]', '"x"', '1', 'null', '[{"status": "PRONTO"}]'):
                with self.subTest(path=path, raw=raw):
                    r = self.client.post(path, raw, content_type='application/json')
                    self.assertEqual(r.status_code, 400)
