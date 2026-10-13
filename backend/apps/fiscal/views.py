from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes as perm_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import AuditService
from apps.orders.models import Order
from apps.users.permissions import IsCaixa, IsManager
from .models import FiscalSettings, Invoice
from .serializers import (FiscalSettingsSerializer, FiscalSettingsWriteSerializer,
                          InvoiceSerializer)
from .services import NFCeService


class FiscalSettingsView(APIView):
    """GET/PUT /api/fiscal/settings/ — dados do emitente e credenciais NFC-e."""
    permission_classes = [IsManager]

    def get(self, request):
        return Response(FiscalSettingsSerializer(FiscalSettings.load()).data)

    def put(self, request):
        settings = FiscalSettings.load()
        ser = FiscalSettingsWriteSerializer(settings, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        AuditService.log(user=request.user, action='UPDATE', entity='FiscalSettings',
                         entity_id=1, details='Configuração fiscal atualizada', request=request)
        return Response(FiscalSettingsSerializer(FiscalSettings.load()).data)


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Invoice.objects.select_related('order', 'order__table').all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsCaixa]
    filterset_fields = ['status', 'ambiente']

    def _log(self, request, invoice, details):
        AuditService.log(user=request.user, action='UPDATE', entity='Invoice',
                         entity_id=invoice.id, details=details, request=request)

    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)


@api_view(['POST'])
@perm_classes([IsCaixa])
def build_from_order(request, order_id):
    order = get_object_or_404(Order, pk=order_id)
    invoice = NFCeService.build_from_order(order, user=request.user)
    AuditService.log(user=request.user, action='CREATE', entity='Invoice', entity_id=invoice.id,
                     details=f'NFC-e gerada (rascunho) para o Pedido #{order.id} — status {invoice.status}',
                     request=request)
    return Response(InvoiceSerializer(invoice).data, status=201)


@api_view(['POST'])
@perm_classes([IsCaixa])
def sign_invoice(request, pk):
    invoice = get_object_or_404(Invoice, pk=pk)
    invoice, faltando = NFCeService.sign(invoice)
    data = InvoiceSerializer(invoice).data
    if faltando:
        data['faltando'] = faltando
    return Response(data)


@api_view(['POST'])
@perm_classes([IsCaixa])
def transmit_invoice(request, pk):
    invoice = get_object_or_404(Invoice, pk=pk)
    invoice, result = NFCeService.transmit(invoice)
    data = InvoiceSerializer(invoice).data
    data['resultado'] = {
        'autorizada': result.autorizada, 'status': result.status,
        'mensagem': result.mensagem, 'faltando': result.faltando,
    }
    AuditService.log(user=request.user, action='UPDATE', entity='Invoice', entity_id=invoice.id,
                     details=f'Transmissão NFC-e #{invoice.id}: {result.status} — {result.mensagem}',
                     request=request)
    return Response(data)


@api_view(['GET'])
@perm_classes([IsCaixa])
def invoice_xml(request, pk):
    invoice = get_object_or_404(Invoice, pk=pk)
    xml = invoice.xml_assinado or invoice.xml or ''
    resp = HttpResponse(xml, content_type='application/xml')
    resp['Content-Disposition'] = f'attachment; filename="nfce-{invoice.id}.xml"'
    return resp
