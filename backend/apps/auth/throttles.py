"""
Throttles do login — barram força bruta por IP e por conta (e-mail).
"""
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Tentativas de login por IP."""
    scope = 'login'


class LoginEmailRateThrottle(SimpleRateThrottle):
    """Tentativas de login por e-mail (mesmo vindo de IPs diferentes)."""
    scope = 'login_email'

    def get_cache_key(self, request, view):
        email = str(request.data.get('email', '')).strip().lower()
        if not email:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': email}


class RefreshRateThrottle(AnonRateThrottle):
    scope = 'refresh'
