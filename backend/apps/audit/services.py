"""
Audit service - registro centralizado de ações.
"""
from django.conf import settings


def client_ip(request):
    """Extrai o IP do cliente respeitando proxy reverso.

    Usa o IP que o NOSSO proxy anexou (o N-ésimo a partir da direita, N =
    NUM_PROXIES): o primeiro item do X-Forwarded-For é enviado pelo cliente
    e pode ser forjado.
    """
    if request is None:
        return None
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    num_proxies = settings.REST_FRAMEWORK.get('NUM_PROXIES') or 0
    if forwarded and num_proxies:
        addrs = [a.strip() for a in forwarded.split(',') if a.strip()]
        if addrs:
            return addrs[-min(num_proxies, len(addrs))]
    return request.META.get('REMOTE_ADDR')


class AuditService:
    @staticmethod
    def log(user, action: str, entity: str, entity_id=None, details: str = '',
            ip_address=None, request=None):
        """Cria uma entrada de auditoria. Nunca deixa o fluxo principal quebrar.

        Se ``request`` for passado, o IP e (quando ``user`` for None) o usuário
        autenticado são extraídos dele.
        """
        try:
            from .models import AuditLog

            if request is not None:
                if ip_address is None:
                    ip_address = client_ip(request)
                if user is None and getattr(request, 'user', None) and request.user.is_authenticated:
                    user = request.user

            AuditLog.objects.create(
                user=user if getattr(user, 'is_authenticated', False) else None,
                action=action,
                entity=entity,
                entity_id=entity_id,
                details=details,
                ip_address=ip_address,
            )
        except Exception:
            # Auditoria nunca derruba a operação de negócio.
            pass
