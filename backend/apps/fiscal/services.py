"""
Orquestração da NFC-e: gerar rascunho a partir do pedido, assinar, transmitir.
"""
import secrets
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.orders.models import OrderStatus
from . import sefaz
from .access_key import build_access_key
from .models import FiscalSettings, Invoice, InvoiceStatus
from .qrcode_nfce import build_qrcode
from .xml_builder import build_nfce_xml


class NFCeService:
    @staticmethod
    @transaction.atomic
    def build_from_order(order, user=None):
        """Cria a NFC-e (rascunho) do pedido: número, chave de acesso, XML e QR Code."""
        settings = FiscalSettings.load()

        if not settings.cnpj or not settings.uf:
            inv = Invoice.objects.create(
                order=order, status=InvoiceStatus.NAO_CONFIGURADO,
                motivo='Configure CNPJ, UF e IE do emitente em Configuração Fiscal.',
                created_by=user,
            )
            return inv

        if order.status == OrderStatus.CANCELADO:
            raise ValidationError('Pedido cancelado não gera NFC-e.')
        if not order.items.exclude(status='CANCELADO').exists():
            raise ValidationError('Pedido sem itens ativos.')

        numero = settings.proximo_numero
        serie = settings.serie_nfce
        codigo = f"{secrets.randbelow(100_000_000):08d}"

        invoice = Invoice(
            order=order, numero=numero, serie=serie, codigo_numerico=codigo,
            ambiente=settings.environment, status=InvoiceStatus.RASCUNHO,
            valor_total=order.total_amount or Decimal('0'), created_by=user,
        )
        invoice.chave_acesso = build_access_key(
            uf=settings.uf, cnpj=settings.cnpj, serie=serie, numero=numero,
            codigo_numerico=int(codigo),
        )
        invoice.save()

        invoice.xml = build_nfce_xml(invoice, order, settings)
        if settings.csc_id and settings.csc_token:
            invoice.qr_code_data = build_qrcode(
                chave=invoice.chave_acesso, tp_amb=settings.environment,
                csc_id=settings.csc_id, csc_token=settings.csc_token, uf=settings.uf,
            )
        invoice.save(update_fields=['xml', 'qr_code_data'])

        settings.proximo_numero = numero + 1
        settings.save(update_fields=['proximo_numero', 'updated_at'])
        return invoice

    @staticmethod
    def sign(invoice):
        settings = FiscalSettings.load()
        try:
            invoice.xml_assinado = sefaz.sign_xml(invoice.xml, settings)
        except sefaz.SefazNaoConfigurado as exc:
            invoice.status = InvoiceStatus.NAO_CONFIGURADO
            invoice.motivo = str(exc)
            invoice.save(update_fields=['status', 'motivo'])
            return invoice, exc.faltando
        invoice.status = InvoiceStatus.ASSINADA
        invoice.motivo = 'XML assinado.'
        invoice.save(update_fields=['xml_assinado', 'status', 'motivo'])
        return invoice, []

    @staticmethod
    def transmit(invoice):
        settings = FiscalSettings.load()
        xml = invoice.xml_assinado or invoice.xml
        result = sefaz.transmitir(xml, settings)

        if result.status == 'NAO_CONFIGURADO':
            invoice.status = InvoiceStatus.NAO_CONFIGURADO
        elif result.autorizada:
            invoice.status = InvoiceStatus.AUTORIZADA
            invoice.protocolo_autorizacao = result.protocolo
            invoice.autorizada_em = timezone.now()
        else:
            invoice.status = InvoiceStatus.REJEITADA
        invoice.motivo = result.mensagem
        invoice.save(update_fields=['status', 'protocolo_autorizacao', 'autorizada_em', 'motivo'])
        return invoice, result
