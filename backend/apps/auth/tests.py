"""
Testes dos endpoints de autenticação JWT.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class AuthFlowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            name='Admin', email='admin@toca.com', password='123456', role='ADM_MAXIMO',
        )

    def login(self, email='admin@toca.com', password='123456'):
        return self.client.post('/api/auth/login/', {'email': email, 'password': password}, format='json')

    def test_login_ok(self):
        r = self.login()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.data), {'access', 'refresh', 'user'})
        self.assertEqual(r.data['user']['email'], 'admin@toca.com')

    def test_login_bad_password_is_401(self):
        self.assertEqual(self.login(password='wrong').status_code, 401)

    def test_login_missing_field_is_400(self):
        r = self.client.post('/api/auth/login/', {'email': 'admin@toca.com'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_login_inactive_is_401(self):
        # O ModelBackend recusa conta inativa como credencial inválida: resposta
        # genérica 401, que não revela se a conta existe.
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        self.assertEqual(self.login().status_code, 401)

    def test_me_requires_token(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_me_with_token(self):
        access = self.login().data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        r = self.client.get('/api/auth/me/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['role'], 'ADM_MAXIMO')

    def test_refresh_rotates_token(self):
        refresh = self.login().data['refresh']
        r = self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('access', r.data)

    def test_logout_blacklists_refresh(self):
        tokens = self.login().data
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')
        r = self.client.post('/api/auth/logout/', {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(r.status_code, 200)

        r = self.client.post('/api/auth/refresh/', {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(r.status_code, 401)


class AuthSecurityTests(APITestCase):
    """Caixa branca: ataques ao fluxo de autenticação."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            name='Admin', email='admin@toca.com', password='S3nha-Forte!', role='ADM_MAXIMO',
        )

    def setUp(self):
        from django.core.cache import cache
        cache.clear()  # throttles guardam estado no cache

    def login(self, email='admin@toca.com', password='S3nha-Forte!', **extra):
        return self.client.post('/api/auth/login/', {'email': email, 'password': password},
                                format='json', **extra)

    def test_login_bruteforce_is_throttled_per_ip(self):
        from django.conf import settings
        limit = int(settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['login'].split('/')[0])
        codes = [self.login(email=f'x{i}@t.com', password='errada').status_code for i in range(limit + 1)]
        self.assertEqual(codes[-1], 429)
        self.assertNotIn(429, codes[:limit])

    def test_login_bruteforce_is_throttled_per_email_across_ips(self):
        from django.conf import settings
        limit = int(settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['login_email'].split('/')[0])
        last = None
        for i in range(limit + 1):
            # IP diferente a cada tentativa (o proxy anexa o IP real no fim do XFF).
            last = self.login(password='errada', HTTP_X_FORWARDED_FOR=f'10.0.{i // 250}.{i % 250}')
        self.assertEqual(last.status_code, 429)

    def test_email_is_case_insensitive_and_trimmed(self):
        self.assertEqual(self.login(email='  ADMIN@toca.com ').status_code, 200)

    def test_error_does_not_reveal_if_account_exists(self):
        a = self.login(email='admin@toca.com', password='errada')
        b = self.login(email='naoexiste@toca.com', password='errada')
        self.assertEqual(a.status_code, b.status_code)
        self.assertEqual(a.data, b.data)

    def test_tampered_token_rejected(self):
        access = self.login().data['access']
        head, body, sig = access.split('.')
        forged = f'{head}.{body}.{sig[:-2]}xx'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {forged}')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_alg_none_token_rejected(self):
        import base64, json
        def b64(d):
            return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b'=').decode()
        token = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'user_id': self.user.id, 'token_type': 'access', 'exp': 9999999999, 'jti': 'x'})}."
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_refresh_token_cannot_be_used_as_access(self):
        refresh = self.login().data['refresh']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh}')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_expired_access_token_rejected(self):
        from datetime import timedelta
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken.for_user(self.user)
        token.set_exp(lifetime=-timedelta(seconds=1))
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_deactivated_user_access_token_stops_working(self):
        access = self.login().data['access']
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_rotated_refresh_cannot_be_reused(self):
        refresh = self.login().data['refresh']
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json').status_code, 200)
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json').status_code, 401)

    def test_audit_ip_ignores_spoofed_forwarded_for(self):
        from apps.audit.models import AuditLog
        # Cliente forja "1.2.3.4"; o proxy anexou o IP real "200.1.1.1".
        self.login(HTTP_X_FORWARDED_FOR='1.2.3.4, 200.1.1.1')
        log = AuditLog.objects.filter(action='LOGIN').latest('id')
        self.assertEqual(log.ip_address, '200.1.1.1')
