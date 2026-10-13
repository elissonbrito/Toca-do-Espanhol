"""
Matriz de permissões (caixa branca): cada endpoint x cada perfil.

Para cada rota, os perfis fora da lista devem receber 403, o anônimo 401
(ou 200 nas rotas públicas) e os perfis permitidos nunca 401/403 — podem
receber 404/400 porque os ids não existem: a checagem de permissão do DRF
roda antes de buscar o objeto, então não precisamos de dados.
"""
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

User = get_user_model()

ADM, GER, GAR, COZ, PAR, CAI, REC = (
    'ADM_MAXIMO', 'GERENTE', 'GARCOM', 'COZINHA', 'PARRILLA', 'CAIXA', 'RECEPCAO')
ALL = {ADM, GER, GAR, COZ, PAR, CAI, REC}
MGR = {ADM, GER}
CAIXA = {CAI, ADM, GER}
FLOOR = {GAR, REC, ADM, GER}
FLOOR_CAIXA = FLOOR | {CAI}
CAIXA_ADM = {CAI, ADM}
RECEP = {REC, ADM, GER}
KITCHEN = {COZ, PAR, ADM, GER}
ONLY_ADM = {ADM}
PUBLIC = 'PUBLIC'

X = 999999  # id inexistente

MATRIX = [
    # auth
    ('get', '/api/auth/me/', ALL),
    # users
    ('get', '/api/users/', MGR),
    ('get', f'/api/users/{X}/', MGR),
    ('post', '/api/users/', ONLY_ADM),
    ('patch', f'/api/users/{X}/', ONLY_ADM),
    ('delete', f'/api/users/{X}/', ONLY_ADM),
    ('get', '/api/users/me/', ALL),
    # tables
    ('get', '/api/tables/', ALL),
    ('post', '/api/tables/', MGR),
    ('patch', f'/api/tables/{X}/', MGR),
    ('delete', f'/api/tables/{X}/', MGR),
    ('post', f'/api/tables/{X}/status/', ALL),
    # orders
    ('get', '/api/orders/', ALL),
    ('post', '/api/orders/', FLOOR),
    ('patch', f'/api/orders/{X}/', MGR),
    ('delete', f'/api/orders/{X}/', CAIXA),
    ('post', f'/api/orders/{X}/add_item/', ALL),
    ('delete', f'/api/orders/{X}/items/1/', CAIXA),
    ('post', f'/api/orders/{X}/close_bill/', FLOOR_CAIXA),
    ('post', f'/api/orders/{X}/reopen_bill/', CAIXA),
    ('post', f'/api/orders/{X}/transfer-table/', CAIXA_ADM),
    ('post', f'/api/orders/{X}/transfer-items/', CAIXA_ADM),
    ('post', f'/api/orders/{X}/update_status/', ALL),
    # menu
    ('get', '/api/menu/categories/', ALL),
    ('post', '/api/menu/categories/', MGR),
    ('delete', f'/api/menu/categories/{X}/', MGR),
    ('get', '/api/menu/items/', ALL),
    ('post', '/api/menu/items/', MGR),
    ('patch', f'/api/menu/items/{X}/', MGR),
    ('delete', f'/api/menu/items/{X}/', MGR),
    ('get', f'/api/menu/items/{X}/fiscal_check/', ALL),
    ('get', '/api/menu/items/fiscal_report/', MGR),
    ('get', '/api/menu/items/fiscal_choices/', MGR),
    ('get', '/api/menu/items/ncm_suggestions/', MGR),
    # fiscal
    ('get', '/api/fiscal/settings/', MGR),
    ('put', '/api/fiscal/settings/', MGR),
    ('get', '/api/fiscal/nfce/', CAIXA),
    ('get', f'/api/fiscal/nfce/{X}/', CAIXA),
    ('get', f'/api/fiscal/nfce/{X}/xml/', CAIXA),
    ('post', f'/api/fiscal/nfce/from-order/{X}/', CAIXA),
    ('post', f'/api/fiscal/nfce/{X}/sign/', CAIXA),
    ('post', f'/api/fiscal/nfce/{X}/transmit/', CAIXA),
    # queue
    ('get', '/api/queue/public_display/', PUBLIC),
    ('get', '/api/queue/', ALL),
    ('post', '/api/queue/', RECEP),
    ('patch', f'/api/queue/{X}/', MGR),
    ('delete', f'/api/queue/{X}/', MGR),
    ('patch', f'/api/queue/{X}/edit/', RECEP),
    ('post', '/api/queue/call_next/', RECEP),
    ('post', f'/api/queue/{X}/call/', RECEP),
    ('post', f'/api/queue/{X}/finalize/', RECEP),
    ('post', f'/api/queue/{X}/cancel/', RECEP),
    ('post', f'/api/queue/{X}/open-order/', FLOOR),
    ('post', f'/api/queue/{X}/assign-table/', RECEP),
    # kitchen
    ('get', '/api/kitchen/orders/', KITCHEN),
    ('patch', f'/api/kitchen/items/{X}/status/', KITCHEN),
    # cash register
    ('get', '/api/cash-register/registers/', CAIXA),
    ('post', '/api/cash-register/registers/', CAIXA),
    ('get', '/api/cash-register/registers/current/', CAIXA),
    ('post', f'/api/cash-register/registers/{X}/close/', CAIXA),
    ('get', f'/api/cash-register/registers/{X}/report/', CAIXA),
    ('get', '/api/cash-register/registers/pending-orders/', CAIXA),
    ('get', '/api/cash-register/payments/', CAIXA),
    ('post', '/api/cash-register/payments/', CAIXA),
    # audit / dashboard / reports
    ('get', '/api/audit/', MGR),
    ('get', '/api/dashboard/', ONLY_ADM),
    ('get', '/api/reports/sales-by-waiter/', MGR),
    ('get', '/api/reports/waiter-detail/', MGR),
    ('get', '/api/reports/item-ranking/', MGR),
    # printing
    ('get', '/api/printing/printers/', ALL),
    ('post', '/api/printing/printers/', MGR),
    ('delete', f'/api/printing/printers/{X}/', MGR),
    ('get', '/api/printing/settings/', ALL),
    ('put', '/api/printing/settings/', MGR),
    ('get', '/api/printing/jobs/', ALL),
]

# Métodos que o servidor NÃO deve aceitar (dados financeiros imutáveis via API).
FORBIDDEN_METHODS = [
    ('put', f'/api/cash-register/registers/{X}/'),
    ('patch', f'/api/cash-register/registers/{X}/'),
    ('delete', f'/api/cash-register/registers/{X}/'),
    ('put', f'/api/cash-register/payments/{X}/'),
    ('patch', f'/api/cash-register/payments/{X}/'),
    ('delete', f'/api/cash-register/payments/{X}/'),
    ('post', '/api/audit/'),
    ('delete', f'/api/audit/{X}/'),
    ('post', '/api/fiscal/nfce/'),
    ('delete', f'/api/fiscal/nfce/{X}/'),
]


class PermissionMatrixTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.users = {
            role: User.objects.create_user(name=role, email=f'{role.lower()}@t.com',
                                           password='x', role=role)
            for role in ALL
        }

    def setUp(self):
        cache.clear()

    def _call(self, method, url):
        return getattr(self.client, method)(url, {}, format='json')

    def test_anonymous(self):
        for method, url, allowed in MATRIX:
            with self.subTest(method=method, url=url):
                self.client.force_authenticate(None)
                code = self._call(method, url).status_code
                if allowed == PUBLIC:
                    self.assertEqual(code, 200)
                else:
                    self.assertEqual(code, 401, f'{method.upper()} {url} aberto para anônimo')

    def test_each_role(self):
        for method, url, allowed in MATRIX:
            if allowed == PUBLIC:
                continue
            for role, user in self.users.items():
                with self.subTest(method=method, url=url, role=role):
                    self.client.force_authenticate(user)
                    code = self._call(method, url).status_code
                    if role in allowed:
                        self.assertNotIn(code, (401, 403), f'{role} bloqueado em {method.upper()} {url}')
                    else:
                        self.assertEqual(code, 403, f'{role} acessou {method.upper()} {url} ({code})')

    def test_immutable_financial_records(self):
        self.client.force_authenticate(self.users[ADM])
        for method, url in FORBIDDEN_METHODS:
            with self.subTest(method=method, url=url):
                self.assertIn(self._call(method, url).status_code, (403, 405))
