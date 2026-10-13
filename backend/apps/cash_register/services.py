"""
Cash register services - abertura/fechamento de caixa e registro de pagamentos.
"""
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.orders.models import OrderStatus
from apps.orders.services import OrderService, CLOSED_STATUSES
from .models import CashRegister, Payment, CashRegisterStatus


def _to_decimal(value, field):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({field: 'Valor numérico inválido.'})


class CashRegisterService:
    @staticmethod
    def current_open():
        return CashRegister.objects.filter(status=CashRegisterStatus.ABERTO).first()

    @staticmethod
    @transaction.atomic
    def open(*, opened_by, initial_amount=0, observations=''):
        if CashRegisterService.current_open():
            raise ValidationError('Já existe um caixa aberto.')
        return CashRegister.objects.create(
            opened_by=opened_by,
            initial_amount=_to_decimal(initial_amount, 'initial_amount'),
            observations=observations,
        )

    @staticmethod
    @transaction.atomic
    def close(register, *, closed_by, final_amount, observations=''):
        if register.status == CashRegisterStatus.FECHADO:
            raise ValidationError('Este caixa já está fechado.')
        register.final_amount = _to_decimal(final_amount, 'final_amount')
        register.status = CashRegisterStatus.FECHADO
        register.closed_by = closed_by
        register.closed_at = timezone.now()
        if observations:
            register.observations = observations
        register.save(update_fields=[
            'final_amount', 'status', 'closed_by', 'closed_at', 'observations',
        ])
        return register

    @staticmethod
    def report(register):
        payments = register.payments.all()
        by_method = list(payments.values('payment_method').annotate(total=Sum('amount')))
        expected_cash = register.initial_amount + (
            payments.filter(payment_method='DINHEIRO').aggregate(t=Sum('amount'))['t'] or 0
        )
        return {
            'register': register,
            'total_revenue': payments.aggregate(total=Sum('amount'))['total'] or 0,
            'by_method': by_method,
            'payment_count': payments.count(),
            'expected_cash_amount': expected_cash,
        }


class PaymentService:
    @staticmethod
    @transaction.atomic
    def register_payment(*, order, amount, payment_method, received_by, observations=''):
        """Dá baixa na conta: registra o pagamento, finaliza a comanda e dispara a
        NFC-e automaticamente. Retorna (payment, invoice|None).

        NÃO libera a mesa — quem controla o ciclo OCUPADA -> LIMPEZA -> LIVRE é o
        garçom, à parte do pagamento.
        """
        register = CashRegisterService.current_open()
        if register is None:
            raise ValidationError('Nenhum caixa aberto. Abra o caixa antes de registrar pagamentos.')
        if order.status in CLOSED_STATUSES:
            raise ValidationError({'order': 'Este pedido já está finalizado ou cancelado.'})
        if order.table_id is None:
            raise ValidationError({'order': 'Comanda de senha sem mesa — destine a senha a uma mesa antes.'})

        amount = _to_decimal(amount, 'amount')
        if not amount.is_finite() or amount <= 0:
            raise ValidationError({'amount': 'Informe um valor maior que zero.'})

        payment = Payment.objects.create(
            order=order,
            cash_register=register,
            amount=amount,
            payment_method=payment_method,
            received_by=received_by,
            observations=observations,
        )
        # Finaliza a comanda. A mesa NÃO é liberada aqui — o garçom faz
        # OCUPADA -> LIMPEZA -> LIVRE manualmente depois.
        OrderService.change_status(order, OrderStatus.FINALIZADO, touch_table=False)

        # Lançamento fiscal automático (não bloqueia a baixa se algo falhar).
        invoice = None
        try:
            from apps.fiscal.services import NFCeService
            order.refresh_from_db()
            invoice = NFCeService.build_from_order(order, user=received_by)
        except Exception:
            invoice = None
        return payment, invoice
