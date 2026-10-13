"""
Orders services - regra de negócio de comandas fora das views.

As views cuidam de HTTP + auditoria; aqui fica o domínio (transições de
status, efeito colateral na mesa, recálculo de total).
"""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.tables.models import TableStatus
from apps.utils import parse_id
from .models import Order, OrderItem, OrderStatus, ItemStatus

CLOSED_STATUSES = {OrderStatus.FINALIZADO, OrderStatus.CANCELADO}
# Estados em que a comanda não aceita mais itens novos.
LOCKED_FOR_ITEMS = CLOSED_STATUSES | {OrderStatus.FECHAMENTO}


class OrderService:
    @staticmethod
    @transaction.atomic
    def open_order(*, table=None, opened_by, customer_name='', people_count=1,
                   observations='', queue_ticket=None):
        """Abre uma comanda.

        Com ``table``: marca a mesa como ocupada (comanda normal).
        Sem ``table`` (só ``queue_ticket``): comanda "da senha", o cliente pede
        enquanto espera; a mesa é vinculada depois via :meth:`attach_table`.
        """
        if table is not None and table.orders.exclude(status__in=CLOSED_STATUSES).exists():
            raise ValidationError({'table': 'Já existe uma comanda aberta para esta mesa.'})

        order = Order.objects.create(
            table=table,
            opened_by=opened_by,
            queue_ticket=queue_ticket,
            customer_name=customer_name,
            people_count=people_count,
            observations=observations,
        )
        if table is not None and table.status != TableStatus.OCUPADA:
            table.status = TableStatus.OCUPADA
            table.save(update_fields=['status', 'updated_at'])
        return order

    @staticmethod
    @transaction.atomic
    def attach_table(order, table):
        """Vincula uma mesa a uma comanda que ainda não tem mesa (comanda da senha).

        Os itens já lançados ficam na comanda — passam a pertencer à mesa.
        """
        if order.status in CLOSED_STATUSES:
            raise ValidationError('Esta comanda já foi finalizada ou cancelada.')
        if (table.orders.exclude(status__in=CLOSED_STATUSES)
                .exclude(pk=order.pk).exists()):
            raise ValidationError({'table': f'Mesa {table.number} já tem uma comanda aberta.'})

        order.table = table
        order.save(update_fields=['table'])
        if table.status != TableStatus.OCUPADA:
            table.status = TableStatus.OCUPADA
            table.save(update_fields=['status', 'updated_at'])
        return order

    @staticmethod
    @transaction.atomic
    def add_item(order, *, menu_item=None, product_name=None, quantity=1,
                 unit_price=None, sector=None, observations='', created_by=None):
        """Adiciona um item à comanda e recalcula o total.

        Se ``menu_item`` for informado, nome/preço/setor saem do cardápio (salvo
        override explícito) e os dados fiscais são congelados no item (snapshot).
        Caso contrário, aceita lançamento por texto livre (retrocompatível).
        """
        if order.status in LOCKED_FOR_ITEMS:
            raise ValidationError(
                'A conta está fechada/finalizada — reabra a comanda para lançar mais itens.'
            )

        fiscal_snapshot = {}
        if menu_item is not None:
            if not menu_item.is_active:
                raise ValidationError({'menu_item': 'Este item do cardápio está inativo.'})
            product_name = product_name or menu_item.name
            unit_price = menu_item.price if unit_price is None else unit_price
            sector = sector or menu_item.sector
            fiscal_snapshot = menu_item.fiscal_snapshot

        if not product_name or unit_price is None:
            raise ValidationError('Informe um item do cardápio ou nome e preço do produto.')

        item = OrderItem.objects.create(
            order=order,
            menu_item=menu_item,
            product_name=product_name,
            quantity=quantity,
            unit_price=unit_price,
            sector=sector or 'COZINHA',
            observations=observations,
            created_by=created_by,
            **fiscal_snapshot,
        )
        order.recalculate_total()
        # Nova rodada de pedidos numa comanda que já estava "pronta":
        # volta para PREPARANDO para o item novo chegar à cozinha/painel.
        if order.status in (OrderStatus.PRONTO, OrderStatus.ABERTO):
            order.status = OrderStatus.PREPARANDO
            order.save(update_fields=['status'])
        # Impressão automática (bar/parrilla) — nunca derruba o lançamento.
        try:
            from apps.printing.services import PrintingService
            PrintingService.enqueue_item(order, item)
        except Exception:
            pass
        return item

    @staticmethod
    @transaction.atomic
    def cancel_item(order, item, *, removed_by=None):
        """Cancela (soft) um item e recalcula o total. Registra quem retirou."""
        if item.status == ItemStatus.CANCELADO:
            return item
        item.status = ItemStatus.CANCELADO
        item.removed_by = removed_by
        item.removed_at = timezone.now()
        item.save(update_fields=['status', 'removed_by', 'removed_at', 'updated_at'])
        order.recalculate_total()
        return item

    @staticmethod
    @transaction.atomic
    def transfer_table(order, new_table):
        """Move a comanda inteira para outra mesa (troca de mesa do cliente).

        A mesa antiga vai para LIMPEZA; a nova fica OCUPADA. Restrito a caixa/adm
        na camada de permissão da view.
        """
        if order.status in CLOSED_STATUSES:
            raise ValidationError('Comanda finalizada ou cancelada não troca de mesa.')
        if (new_table.orders.exclude(status__in=CLOSED_STATUSES)
                .exclude(pk=order.pk).exists()):
            raise ValidationError({'table': f'Mesa {new_table.number} já tem uma comanda aberta.'})

        old_table = order.table
        if old_table and old_table.pk == new_table.pk:
            return order, old_table

        order.table = new_table
        order.save(update_fields=['table'])
        if new_table.status != TableStatus.OCUPADA:
            new_table.status = TableStatus.OCUPADA
            new_table.save(update_fields=['status', 'updated_at'])
        if old_table:
            old_table.status = TableStatus.LIMPEZA
            old_table.save(update_fields=['status', 'updated_at'])
        return order, old_table

    @staticmethod
    @transaction.atomic
    def transfer_items(source_order, target_order, item_ids):
        """Transfere itens selecionados de uma comanda para outra e recalcula ambas."""
        if source_order.pk == target_order.pk:
            raise ValidationError('Comanda de origem e destino são a mesma.')
        # Conta já paga/cancelada não pode ter o total alterado.
        if source_order.status in CLOSED_STATUSES:
            raise ValidationError('A comanda de origem está encerrada — não cede itens.')
        if not isinstance(item_ids, (list, tuple)):
            raise ValidationError({'items': 'Envie a lista de ids dos itens.'})
        item_ids = [i for i in map(parse_id, item_ids) if i is not None]
        if target_order.status in LOCKED_FOR_ITEMS:
            raise ValidationError('A comanda de destino está fechada — não aceita itens.')

        items = list(
            source_order.items.filter(pk__in=item_ids)
            .exclude(status=ItemStatus.CANCELADO)
        )
        if not items:
            raise ValidationError('Selecione ao menos um item válido para transferir.')

        for it in items:
            it.order = target_order
            it.save(update_fields=['order'])
        source_order.recalculate_total()
        target_order.recalculate_total()
        return items

    ACTIVE_ITEM_STATUSES = {ItemStatus.PENDENTE, ItemStatus.PREPARANDO}

    @staticmethod
    @transaction.atomic
    def set_item_status(item, new_status):
        """Transição de status de um item (usada pela cozinha/parrilla).

        Retorna (status_anterior, item). Quando o item fica PRONTO e não há
        mais itens pendentes/preparando, a comanda inteira vira PRONTO.
        """
        if new_status not in ItemStatus.values:
            raise ValidationError({'status': 'Status inválido.'})

        old_status = item.status
        if old_status == new_status:
            return old_status, item

        item.status = new_status
        item.save(update_fields=['status', 'updated_at'])

        order = item.order
        if new_status == ItemStatus.PRONTO:
            remaining = order.items.filter(status__in=OrderService.ACTIVE_ITEM_STATUSES).exists()
            if not remaining and order.status not in LOCKED_FOR_ITEMS:
                order.status = OrderStatus.PRONTO
                order.save(update_fields=['status'])
        elif new_status in OrderService.ACTIVE_ITEM_STATUSES and order.status == OrderStatus.PRONTO:
            # Voltou a ter item em preparo: comanda deixa de estar "pronta".
            order.status = OrderStatus.PREPARANDO
            order.save(update_fields=['status'])

        return old_status, item

    @staticmethod
    @transaction.atomic
    def close_bill(order):
        """"Fechar conta": manda a comanda para o caixa (status FECHAMENTO).

        NÃO mexe na mesa: ela continua OCUPADA e o garçom controla o ciclo
        OCUPADA -> LIMPEZA -> LIVRE manualmente, à parte da conta. A conta fica
        em evidência no caixa e não aceita mais itens (salvo reabertura).
        """
        if order.status in CLOSED_STATUSES:
            raise ValidationError('Esta comanda já está finalizada ou cancelada.')
        if order.status == OrderStatus.FECHAMENTO:
            return OrderStatus.FECHAMENTO, order
        if not order.items.exclude(status=ItemStatus.CANCELADO).exists():
            raise ValidationError('Não há itens lançados nesta comanda.')

        old_status = order.status
        order.status = OrderStatus.FECHAMENTO
        order.save(update_fields=['status'])
        return old_status, order

    @staticmethod
    @transaction.atomic
    def reopen_bill(order):
        """Reabre uma conta que foi fechada mas ainda não foi paga.

        Não toca na mesa — o status da mesa é responsabilidade do garçom.
        """
        if order.status != OrderStatus.FECHAMENTO:
            raise ValidationError('Só é possível reabrir uma conta que está em fechamento.')
        order.status = OrderStatus.PRONTO if order.items.exists() else OrderStatus.ABERTO
        order.save(update_fields=['status'])
        return order

    @staticmethod
    @transaction.atomic
    def change_status(order, new_status, *, free_table=False, touch_table=True):
        """Aplica uma transição de status na comanda.

        Retorna (status_anterior, order). Ao FINALIZAR/CANCELAR marca ``closed_at``.
        Efeito na mesa (só quando ``touch_table=True``): CANCELADO ou
        ``free_table=True`` -> LIVRE; caso contrário -> LIMPEZA. Com
        ``touch_table=False`` a mesa não é alterada (o garçom controla o ciclo).
        """
        if new_status not in OrderStatus.values:
            raise ValidationError({'status': 'Status inválido.'})

        old_status = order.status
        if old_status == new_status:
            return old_status, order

        if new_status == OrderStatus.FINALIZADO and order.table_id is None:
            raise ValidationError(
                'Vincule uma mesa à comanda da senha antes de finalizar.')

        if new_status == OrderStatus.CANCELADO and order.payments.exists():
            raise ValidationError(
                'Esta conta já tem pagamento registrado — não pode ser cancelada.')

        order.status = new_status
        update_fields = ['status']

        if new_status in (OrderStatus.FINALIZADO, OrderStatus.CANCELADO):
            order.closed_at = timezone.now()
            update_fields.append('closed_at')
            if touch_table and order.table_id:
                if new_status == OrderStatus.CANCELADO or free_table:
                    order.table.status = TableStatus.LIVRE
                else:
                    order.table.status = TableStatus.LIMPEZA
                order.table.save(update_fields=['status', 'updated_at'])

        order.save(update_fields=update_fields)
        return old_status, order
