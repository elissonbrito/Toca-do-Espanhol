"""
Queue services - regra de negócio da fila de senhas.
"""
from django.db import transaction
from django.db.models import Case, When, Value, IntegerField
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.tables.models import TableStatus
from .models import QueueTicket, TicketStatus, PriorityCategory, PRIORITY_RANK

OPEN_STATUSES = {TicketStatus.AGUARDANDO, TicketStatus.CHAMADO}
CLOSED_TICKET_STATUSES = {TicketStatus.FINALIZADO, TicketStatus.CANCELADO}

# Anotação reutilizável: rank de prioridade (0 = 80+, 1 = demais prioridades,
# 2 = sem prioridade), pra ordenar filas priorizando por lei e, dentro da
# prioridade, por ordem de chegada.
PRIORITY_RANK_CASE = Case(
    *[When(priority_category=cat, then=Value(rank)) for cat, rank in PRIORITY_RANK.items()],
    default=Value(2), output_field=IntegerField(),
)


class QueueService:
    @staticmethod
    @transaction.atomic
    def issue_ticket(*, customer_name='', people_count=1, priority_category='NENHUMA'):
        """Emite uma nova senha com código sequencial do dia.

        Prioritária -> "P001", "P002"...; normal -> "001", "002"... — duas
        contagens independentes.
        """
        is_priority = priority_category != PriorityCategory.NENHUMA
        return QueueTicket.objects.create(
            code=QueueTicket.generate_code(is_priority=is_priority),
            customer_name=customer_name,
            people_count=people_count,
            priority_category=priority_category,
        )

    @staticmethod
    @transaction.atomic
    def call_next(called_by, group='all'):
        """Chama a próxima senha aguardando.

        ``group``: 'all' (padrão — respeita a ordem legal de prioridade: 80+
        primeiro, demais prioridades em seguida, depois os demais), 'priority'
        (só a fila prioritária) ou 'normal' (só a fila normal) — para a
        recepção poder chamar de qualquer uma das duas filas conforme a
        disponibilidade do salão. Dentro de cada grupo, sempre por ordem de
        chegada. Lança ValidationError se o grupo escolhido estiver vazio.
        """
        qs = QueueTicket.objects.select_for_update().filter(status=TicketStatus.AGUARDANDO)
        if group == 'priority':
            qs = qs.exclude(priority_category=PriorityCategory.NENHUMA)
        elif group == 'normal':
            qs = qs.filter(priority_category=PriorityCategory.NENHUMA)

        ticket = qs.annotate(_prio=PRIORITY_RANK_CASE).order_by('_prio', 'created_at').first()
        if ticket is None:
            msgs = {'priority': 'Nenhuma senha prioritária na fila.', 'normal': 'Nenhuma senha na fila normal.'}
            raise ValidationError(msgs.get(group, 'Nenhuma senha na fila.'))
        ticket.status = TicketStatus.CHAMADO
        ticket.called_at = timezone.now()
        ticket.called_by = called_by
        ticket.save(update_fields=['status', 'called_at', 'called_by'])
        return ticket

    @staticmethod
    @transaction.atomic
    def call_ticket(ticket, called_by):
        """Chama uma senha específica, fora da ordem da fila — a recepção
        escolheu chamar essa e não a próxima pela regra de prioridade/chegada.
        """
        if ticket.status != TicketStatus.AGUARDANDO:
            raise ValidationError('Só é possível chamar uma senha que está aguardando.')
        ticket.status = TicketStatus.CHAMADO
        ticket.called_at = timezone.now()
        ticket.called_by = called_by
        ticket.save(update_fields=['status', 'called_at', 'called_by'])
        return ticket

    @staticmethod
    def set_status(ticket, new_status):
        if new_status not in TicketStatus.values:
            raise ValidationError({'status': 'Status inválido.'})
        ticket.status = new_status
        ticket.save(update_fields=['status'])
        return ticket

    @staticmethod
    def active_order(ticket):
        """Comanda em aberto da senha (a que o cliente usa enquanto espera), se houver."""
        return ticket.orders.exclude(status__in=['FINALIZADO', 'CANCELADO']).first()

    @staticmethod
    @transaction.atomic
    def open_order_for_ticket(ticket, *, opened_by):
        """Abre uma comanda vinculada à senha, ainda SEM mesa.

        Permite lançar itens do cliente enquanto ele aguarda. Ao destinar a
        senha para uma mesa, esta comanda (com os itens) passa para a mesa.
        """
        if ticket.status in CLOSED_TICKET_STATUSES:
            raise ValidationError('Esta senha já foi finalizada ou cancelada.')
        existing = QueueService.active_order(ticket)
        if existing:
            return existing

        from apps.orders.services import OrderService
        return OrderService.open_order(
            opened_by=opened_by,
            queue_ticket=ticket,
            customer_name=ticket.customer_name,
            people_count=ticket.people_count,
        )

    @staticmethod
    @transaction.atomic
    def assign_table(ticket, table, *, seated_by, open_order=True):
        """Destina a senha a uma mesa.

        - Se a senha já tem comanda aberta (pedidos feitos na espera), essa
          comanda é vinculada à mesa — os itens vão junto.
        - Senão, e ``open_order=True``, abre uma comanda nova na mesa.
        Retorna (ticket, order|None). Só ADM/GERENTE/RECEPÇÃO chamam isto (view).
        """
        if ticket.status in CLOSED_TICKET_STATUSES:
            raise ValidationError('Esta senha já foi finalizada ou cancelada.')

        from apps.orders.services import OrderService
        existing = QueueService.active_order(ticket)

        if existing is None and table.status == TableStatus.OCUPADA and open_order:
            raise ValidationError({'table': f'Mesa {table.number} já está ocupada.'})

        ticket.table = table
        ticket.status = TicketStatus.SENTADO
        if not ticket.called_at:
            ticket.called_at = timezone.now()
            ticket.called_by = seated_by
        ticket.save(update_fields=['table', 'status', 'called_at', 'called_by'])

        order = None
        if existing is not None:
            order = OrderService.attach_table(existing, table)
        elif open_order:
            order = OrderService.open_order(
                table=table, opened_by=seated_by, queue_ticket=ticket,
                customer_name=ticket.customer_name, people_count=ticket.people_count,
            )
        elif table.status == TableStatus.LIVRE:
            table.status = TableStatus.RESERVADA
            table.save(update_fields=['status', 'updated_at'])
        return ticket, order
