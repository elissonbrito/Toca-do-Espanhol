from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.tables.models import Table, TableStatus
from apps.orders.models import Order, OrderItem, OrderStatus, ItemSector
from .models import CashRegister, CashRegisterStatus

User = get_user_model()


class CashRegisterTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.caixa = User.objects.create_user(name='Cx', email='cx@t.com', password='x', role='CAIXA')
        cls.garcom = User.objects.create_user(name='G', email='g@t.com', password='x', role='GARCOM')
        cls.table = Table.objects.create(number=1, seats=4)

    def _open_register(self):
        self.client.force_authenticate(self.caixa)
        return self.client.post('/api/cash-register/registers/', {'initial_amount': '100.00'}, format='json')

    def _order(self, total=50):
        order = Order.objects.create(table=self.table, opened_by=self.garcom, status=OrderStatus.PRONTO)
        OrderItem.objects.create(order=order, product_name='X', quantity=1, unit_price=total, sector=ItemSector.BAR)
        order.recalculate_total()
        return order

    def test_garcom_cannot_open_register(self):
        self.client.force_authenticate(self.garcom)
        r = self.client.post('/api/cash-register/registers/', {'initial_amount': '100'}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_double_open_is_400_not_500(self):
        self.assertEqual(self._open_register().status_code, 201)
        r = self.client.post('/api/cash-register/registers/', {'initial_amount': '50'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_payment_without_open_register_is_400(self):
        order = self._order()
        self.client.force_authenticate(self.caixa)
        r = self.client.post('/api/cash-register/payments/',
                             {'order': order.id, 'amount': '50.00', 'payment_method': 'PIX'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_payment_finalizes_order_keeps_table_and_launches_invoice(self):
        self._open_register()
        self.table.status = TableStatus.OCUPADA
        self.table.save(update_fields=['status'])
        order = self._order(80)
        r = self.client.post('/api/cash-register/payments/',
                             {'order': order.id, 'amount': '80.00', 'payment_method': 'CREDITO'}, format='json')
        self.assertEqual(r.status_code, 201)
        order.refresh_from_db()
        self.table.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.FINALIZADO)
        # baixa no caixa NÃO mexe na mesa — o garçom controla o ciclo depois
        self.assertEqual(self.table.status, TableStatus.OCUPADA)
        # NFC-e lançada automaticamente junto com a baixa
        self.assertIn('invoice', r.data)
        from apps.fiscal.models import Invoice
        self.assertTrue(Invoice.objects.filter(order=order).exists())

    def test_close_bill_flow_and_pending_orders(self):
        self._open_register()
        self.table.status = TableStatus.OCUPADA
        self.table.save(update_fields=['status'])
        order = self._order(40)
        order.status = OrderStatus.ABERTO
        order.save(update_fields=['status'])

        # garçom fecha a conta -> vai para o caixa, mesa segue OCUPADA
        self.client.force_authenticate(self.garcom)
        r = self.client.post(f'/api/orders/{order.id}/close_bill/', {}, format='json')
        self.assertEqual(r.data['status'], 'FECHAMENTO')
        self.table.refresh_from_db()
        self.assertEqual(self.table.status, TableStatus.OCUPADA)

        # caixa vê a conta em evidência
        self.client.force_authenticate(self.caixa)
        pend = self.client.get('/api/cash-register/registers/pending-orders/')
        self.assertEqual(pend.status_code, 200)
        self.assertTrue(any(o['id'] == order.id for o in pend.data))

    def test_only_caixa_removes_launched_item(self):
        order = self._order()
        item = order.items.first()
        self.client.force_authenticate(self.garcom)
        self.assertEqual(self.client.delete(f'/api/orders/{order.id}/items/{item.id}/').status_code, 403)
        self.client.force_authenticate(self.caixa)
        self.assertEqual(self.client.delete(f'/api/orders/{order.id}/items/{item.id}/').status_code, 200)

    def test_only_caixa_cancels_bill(self):
        order = self._order()
        order.status = OrderStatus.ABERTO
        order.save(update_fields=['status'])
        self.client.force_authenticate(self.garcom)
        self.assertEqual(
            self.client.post(f'/api/orders/{order.id}/update_status/', {'status': 'CANCELADO'}, format='json').status_code,
            403)
        self.client.force_authenticate(self.caixa)
        self.assertEqual(
            self.client.post(f'/api/orders/{order.id}/update_status/', {'status': 'CANCELADO'}, format='json').status_code,
            200)

    def test_cannot_pay_finalized_order(self):
        self._open_register()
        order = self._order()
        order.status = OrderStatus.FINALIZADO
        order.save(update_fields=['status'])
        r = self.client.post('/api/cash-register/payments/',
                             {'order': order.id, 'amount': '10', 'payment_method': 'PIX'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_close_requires_final_amount(self):
        reg_id = self._open_register().data['id']
        r = self.client.post(f'/api/cash-register/registers/{reg_id}/close/', {}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_close_and_report(self):
        reg_id = self._open_register().data['id']
        order = self._order(60)
        self.client.post('/api/cash-register/payments/',
                         {'order': order.id, 'amount': '60.00', 'payment_method': 'DINHEIRO'}, format='json')
        rep = self.client.get(f'/api/cash-register/registers/{reg_id}/report/')
        self.assertEqual(rep.status_code, 200)
        self.assertEqual(str(rep.data['total_revenue']), '60.00')

        r = self.client.post(f'/api/cash-register/registers/{reg_id}/close/',
                             {'final_amount': '160.00'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(CashRegister.objects.get(pk=reg_id).status, CashRegisterStatus.FECHADO)

    def test_zero_negative_or_invalid_amount_rejected(self):
        self._open_register()
        order = self._order(80)
        for bad in ('0', '0.00', '-80.00', 'NaN', 'Infinity', 'abc'):
            r = self.client.post('/api/cash-register/payments/',
                                 {'order': order.id, 'amount': bad, 'payment_method': 'PIX'}, format='json')
            self.assertEqual(r.status_code, 400, bad)
        order.refresh_from_db()
        self.assertNotEqual(order.status, OrderStatus.FINALIZADO)

    def test_invalid_payment_method_rejected(self):
        self._open_register()
        order = self._order(80)
        r = self.client.post('/api/cash-register/payments/',
                             {'order': order.id, 'amount': '80.00', 'payment_method': 'FIADO'}, format='json')
        self.assertEqual(r.status_code, 400)
