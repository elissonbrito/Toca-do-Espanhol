from rest_framework import serializers
from .models import Order, OrderItem
from apps.users.serializers import UserSerializer
from apps.tables.serializers import TableSerializer


class OrderItemSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    sector_display = serializers.CharField(source='get_sector_display', read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    order_ref = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.name', read_only=True, default=None)
    removed_by_name = serializers.CharField(source='removed_by.name', read_only=True, default=None)

    class Meta:
        model = OrderItem
        fields = [
            'id', 'menu_item', 'product_name', 'quantity', 'unit_price', 'total_price',
            'sector', 'sector_display', 'status', 'status_display',
            'observations', 'created_at', 'updated_at', 'order_id', 'order_ref',
            'created_by', 'created_by_name', 'removed_by', 'removed_by_name', 'removed_at',
            'fiscal_ncm', 'fiscal_cest', 'fiscal_cfop', 'fiscal_csosn',
            'fiscal_origem', 'fiscal_unit',
        ]

    def get_order_ref(self, obj):
        o = obj.order
        if o.table_id:
            return f'Mesa {o.table.number}'
        if o.queue_ticket_id:
            return f'Senha {o.queue_ticket.code}'
        return f'Comanda #{o.id}'
        read_only_fields = [
            'id', 'total_price', 'created_at', 'updated_at',
            'fiscal_ncm', 'fiscal_cest', 'fiscal_cfop', 'fiscal_csosn',
            'fiscal_origem', 'fiscal_unit',
        ]


class OrderItemCreateSerializer(serializers.ModelSerializer):
    """Lançamento de item na comanda — somente itens ativos do cardápio."""

    class Meta:
        model = OrderItem
        fields = ['menu_item', 'quantity', 'observations']
        extra_kwargs = {
            'menu_item': {'required': True, 'allow_null': False},
            'quantity': {'min_value': 1},
        }

    def validate_menu_item(self, value):
        if value is None or not value.is_active:
            raise serializers.ValidationError('Selecione um item ativo do cardápio.')
        return value


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    opened_by = UserSerializer(read_only=True)
    table = TableSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    queue_ticket_code = serializers.CharField(source='queue_ticket.code', read_only=True, default=None)

    class Meta:
        model = Order
        fields = [
            'id', 'table', 'opened_by', 'status', 'status_display',
            'total_amount', 'customer_name', 'people_count', 'observations',
            'queue_ticket', 'queue_ticket_code',
            'items', 'created_at', 'closed_at'
        ]
        read_only_fields = ['id', 'total_amount', 'queue_ticket', 'created_at', 'closed_at']


class OrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['table', 'customer_name', 'people_count', 'observations']
        # Comanda sem mesa só nasce pela fila (QueueService.open_order_for_ticket).
        extra_kwargs = {'table': {'required': True, 'allow_null': False}}
