from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import QueueTicket, TicketStatus
from .serializers import QueueTicketSerializer, QueueTicketCreateSerializer, QueueTicketEditSerializer
from .services import QueueService, PRIORITY_RANK_CASE
from apps.users.permissions import IsManager, IsRecepcao, IsFloorStaff
from apps.audit.services import AuditService


class QueueTicketViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']

    def get_queryset(self):
        # Prioridade primeiro (80+ na frente das demais), FIFO dentro de cada grupo.
        return (QueueTicket.objects
                .select_related('called_by', 'table')
                .prefetch_related('orders')
                .annotate(_prio=PRIORITY_RANK_CASE)
                .order_by('_prio', 'created_at'))

    def get_serializer_class(self):
        if self.action == 'create':
            return QueueTicketCreateSerializer
        return QueueTicketSerializer

    def get_permissions(self):
        if self.action == 'public_display':
            return []  # painel público, sem autenticação
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsManager()]
        if self.action == 'open_order':
            # lançar pedido pela senha: garçom/recepção/gerente/admin
            return [IsFloorStaff()]
        if self.action == 'edit':
            # editar nome/qtd pessoas: quem já gerencia a fila
            return [IsRecepcao()]
        # create, call_next, finalize, cancel, assign_table -> ADM/GERENTE/RECEPÇÃO
        return [IsRecepcao()]

    def create(self, request, *args, **kwargs):
        serializer = QueueTicketCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = QueueService.issue_ticket(**serializer.validated_data)
        AuditService.log(
            user=request.user, action='CREATE', entity='QueueTicket', entity_id=ticket.id,
            details=f'Senha {ticket.code} emitida', request=request,
        )
        return Response(QueueTicketSerializer(ticket).data, status=201)

    @action(detail=False, methods=['get'])
    def public_display(self, request):
        """Painel público: quantidade aguardando + última senha chamada."""
        waiting = QueueTicket.objects.filter(status=TicketStatus.AGUARDANDO).count()
        last_called = (
            QueueTicket.objects.filter(status=TicketStatus.CHAMADO)
            .order_by('-called_at').first()
        )
        return Response({
            'waiting_count': waiting,
            'last_called': QueueTicketSerializer(last_called).data if last_called else None,
        })

    @action(detail=True, methods=['patch'], url_path='edit')
    def edit(self, request, pk=None):
        """Edita nome do cliente e quantidade de pessoas (qualquer texto; 0 é válido)."""
        ticket = self.get_object()
        serializer = QueueTicketEditSerializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        AuditService.log(
            user=request.user, action='UPDATE', entity='QueueTicket', entity_id=ticket.id,
            details=f'Senha {ticket.code} editada (nome/qtd. pessoas)', request=request,
        )
        return Response(QueueTicketSerializer(ticket).data)

    @action(detail=False, methods=['post'])
    def call_next(self, request):
        """POST { group?: 'all'|'priority'|'normal' } — chama a próxima senha
        daquela fila específica, pra recepção escolher de qual chamar."""
        group = request.data.get('group', 'all')
        if group not in ('all', 'priority', 'normal'):
            return Response({'group': 'Valor inválido — use all, priority ou normal.'}, status=400)
        ticket = QueueService.call_next(request.user, group=group)
        AuditService.log(
            user=request.user, action='UPDATE', entity='QueueTicket', entity_id=ticket.id,
            details=f'Senha {ticket.code} chamada (fila: {group})', request=request,
        )
        return Response(QueueTicketSerializer(ticket).data)

    @action(detail=True, methods=['post'])
    def call(self, request, pk=None):
        """Chama esta senha específica, fora da ordem (recepção escolheu na hora)."""
        ticket = QueueService.call_ticket(self.get_object(), request.user)
        AuditService.log(
            user=request.user, action='UPDATE', entity='QueueTicket', entity_id=ticket.id,
            details=f'Senha {ticket.code} chamada manualmente (fora da ordem)', request=request,
        )
        return Response(QueueTicketSerializer(ticket).data)

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        ticket = QueueService.set_status(self.get_object(), TicketStatus.FINALIZADO)
        AuditService.log(
            user=request.user, action='UPDATE', entity='QueueTicket', entity_id=ticket.id,
            details=f'Senha {ticket.code} finalizada', request=request,
        )
        return Response(QueueTicketSerializer(ticket).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        ticket = QueueService.set_status(self.get_object(), TicketStatus.CANCELADO)
        AuditService.log(
            user=request.user, action='UPDATE', entity='QueueTicket', entity_id=ticket.id,
            details=f'Senha {ticket.code} cancelada', request=request,
        )
        return Response(QueueTicketSerializer(ticket).data)

    @action(detail=True, methods=['post'], url_path='open-order')
    def open_order(self, request, pk=None):
        """Abre a comanda da senha (sem mesa) para lançar o que o cliente pede na espera."""
        from apps.orders.serializers import OrderSerializer

        ticket = self.get_object()
        order = QueueService.open_order_for_ticket(ticket, opened_by=request.user)
        AuditService.log(
            user=request.user, action='CREATE', entity='Order', entity_id=order.id,
            details=f'Comanda #{order.id} aberta pela senha {ticket.code}', request=request,
        )
        return Response(OrderSerializer(order).data, status=201)

    @action(detail=True, methods=['post'], url_path='assign-table')
    def assign_table(self, request, pk=None):
        """Destina a senha a uma mesa e (por padrão) abre a comanda."""
        from apps.tables.models import Table

        ticket = self.get_object()
        table = Table.objects.filter(pk=request.data.get('table')).first()
        if table is None:
            return Response({'table': 'Mesa não encontrada.'}, status=400)
        open_order = request.data.get('open_order', True)

        ticket, order = QueueService.assign_table(
            ticket, table, seated_by=request.user, open_order=bool(open_order),
        )
        AuditService.log(
            user=request.user, action='UPDATE', entity='QueueTicket', entity_id=ticket.id,
            details=(f'Senha {ticket.code} enviada para a Mesa {table.number}'
                     + (f' — comanda #{order.id} aberta' if order else '')),
            request=request,
        )
        data = QueueTicketSerializer(ticket).data
        data['order_id'] = order.id if order else None
        return Response(data)
