#!/usr/bin/env python3
"""
Testes de CAIXA PRETA da Toca do Espanhol.

Fala com o sistema só por HTTP(S), como um usuário/atacante externo: não lê
código nem banco. Roda contra qualquer ambiente:

    python3 blackbox.py https://localhost:8443 --admin dono@toca.com --password '...' --insecure
    python3 blackbox.py https://136-248-115-136.sslip.io --admin ... --password ...

Opções:
    --insecure      aceita certificado autoassinado (teste local)
    --http URL      URL http:// para testar o redirecionamento p/ HTTPS
    --db-host HOST  confirma que a porta 5432 NÃO está acessível nesse host
    --admin-path P  caminho secreto do admin (ADMIN_URL) p/ checar que ele existe
    --load N        nº de requisições do teste de carga (padrão 400)

Cria usuários/mesa/comanda de teste com prefixo "bb-" (rode em homologação ou
num banco que possa receber esses dados).
"""
import argparse
import json
import socket
import ssl
import statistics
import sys
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor

RESULTS = []
CTX = ssl.create_default_context()


# ───────────────────────────── infraestrutura ─────────────────────────────
class Resp:
    def __init__(self, status, headers, body):
        self.status, self.headers, self.body = status, headers, body

    @property
    def json(self):
        try:
            return json.loads(self.body or b'null')
        except ValueError:
            return None

    def h(self, name):
        return self.headers.get(name)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def request(method, url, data=None, token=None, headers=None, raw=None, follow=True, timeout=20):
    hdrs = {'Accept': 'application/json'}
    body = None
    if raw is not None:
        body = raw
        hdrs['Content-Type'] = 'application/json'
    elif data is not None:
        body = json.dumps(data).encode()
        hdrs['Content-Type'] = 'application/json'
    if token:
        hdrs['Authorization'] = f'Bearer {token}'
    hdrs.update(headers or {})
    req = urllib.request.Request(url, data=body, method=method.upper(), headers=hdrs)
    handlers = [urllib.request.HTTPSHandler(context=CTX)]
    if not follow:
        handlers.append(NoRedirect())
    opener = urllib.request.build_opener(*handlers)
    try:
        with opener.open(req, timeout=timeout) as r:
            return Resp(r.status, r.headers, r.read())
    except urllib.error.HTTPError as e:
        return Resp(e.code, e.headers, e.read())


def check(name, cond, detail=''):
    RESULTS.append((name, bool(cond), detail))
    mark = '\033[32mPASS\033[0m' if cond else '\033[31mFAIL\033[0m'
    print(f'  [{mark}] {name}' + (f'  — {detail}' if detail and not cond else ''))
    return cond


def section(title):
    print(f'\n\033[1m▶ {title}\033[0m')


# ──────────────────────────────── testes ────────────────────────────────
class BlackBox:
    def __init__(self, base, args):
        self.base = base.rstrip('/')
        self.api = self.base + '/api'
        self.args = args
        self.tag = 'bb-' + uuid.uuid4().hex[:6]
        self.tokens = {}
        self.users = {}

    def call(self, method, path, data=None, role=None, **kw):
        token = self.tokens.get(role) if role else None
        return request(method, self.api + path, data, token=token, **kw)

    # A. Transporte e cabeçalhos ------------------------------------------
    def transport(self):
        section('A. HTTPS, TLS e cabeçalhos de segurança')
        if self.args.http:
            r = request('GET', self.args.http + '/', follow=False)
            check('HTTP redireciona para HTTPS', r.status in (301, 302, 307, 308)
                  and (r.h('Location') or '').startswith('https://'), f'{r.status} {r.h("Location")}')

        host = self.base.split('://', 1)[1].split('/')[0]
        hostname, _, port = host.partition(':')
        import warnings
        warnings.filterwarnings('ignore', category=DeprecationWarning)
        for ver in ('TLSv1', 'TLSv1_1'):
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            try:
                ctx.minimum_version = getattr(ssl.TLSVersion, ver)
                ctx.maximum_version = getattr(ssl.TLSVersion, ver)
                with socket.create_connection((hostname, int(port or 443)), timeout=5) as s:
                    with ctx.wrap_socket(s, server_hostname=hostname):
                        accepted = True
            except (ssl.SSLError, OSError, ValueError):
                accepted = False
            check(f'{ver.replace("_", ".")} recusado (protocolo obsoleto)', not accepted)

        for path in ('/', '/api/auth/me/'):
            r = request('GET', self.base + path)
            hs = {k.lower(): v for k, v in r.headers.items()}
            check(f'HSTS em {path}', 'max-age=' in hs.get('strict-transport-security', ''))
            check(f'X-Content-Type-Options nosniff em {path}', hs.get('x-content-type-options') == 'nosniff')
            check(f'X-Frame-Options DENY em {path}', hs.get('x-frame-options', '').upper() == 'DENY')
            check(f'Servidor não se identifica em {path}', 'server' not in hs, hs.get('server', ''))
        r = request('GET', self.base + '/')
        csp = r.h('Content-Security-Policy') or ''
        check('CSP no frontend (sem unsafe-eval, frame-ancestors none)',
              "default-src 'self'" in csp and 'unsafe-eval' not in csp and "frame-ancestors 'none'" in csp)

    # B. Vazamento de informação -----------------------------------------
    def disclosure(self):
        section('B. Vazamento de informação')
        r = request('GET', self.api + '/nao-existe-' + self.tag + '/')
        text = r.body.decode(errors='ignore')
        check('404 sem página de debug do Django', r.status == 404
              and 'Traceback' not in text and 'URLconf' not in text and 'DEBUG' not in text)
        r = request('POST', self.api + '/auth/login/', raw=b'{"email": ')
        check('JSON malformado -> 400 sem stack trace', r.status == 400 and b'Traceback' not in r.body)
        r = request('GET', self.base + '/admin/')
        check('Admin do Django NÃO está no caminho padrão /admin/',
              b'Django' not in r.body and b'csrfmiddlewaretoken' not in r.body)
        if self.args.admin_path:
            r = request('GET', f'{self.base}/{self.args.admin_path.strip("/")}/login/')
            check('Admin existe no caminho secreto', r.status == 200 and b'csrfmiddlewaretoken' in r.body)
        r = request('GET', self.base + '/.env')
        check('/.env não é servido', b'SECRET_KEY' not in r.body)
        r = request('GET', self.base + '/.git/config')
        check('/.git não é servido', b'[core]' not in r.body)
        if self.args.db_host:
            try:
                socket.create_connection((self.args.db_host, 5432), timeout=4).close()
                open_ = True
            except OSError:
                open_ = False
            check(f'Postgres (5432) inacessível em {self.args.db_host}', not open_)

    # C. Autenticação ----------------------------------------------------
    def authentication(self):
        section('C. Autenticação')
        for path in ('/orders/', '/users/', '/cash-register/registers/', '/dashboard/', '/audit/'):
            check(f'Sem token -> 401 em {path}', self.call('GET', path).status == 401)
        r = self.call('POST', '/auth/login/', {'email': self.args.admin, 'password': 'errada-' + self.tag})
        check('Senha errada -> 401', r.status == 401)
        r2 = self.call('POST', '/auth/login/', {'email': f'{self.tag}@x.com', 'password': 'x'})
        check('Mesma resposta p/ conta inexistente (sem enumeração)', r.status == r2.status and r.body == r2.body)
        r = self.call('POST', '/auth/login/', {'email': self.args.admin, 'password': self.args.password})
        if not check('Login do admin -> 200 com tokens', r.status == 200 and 'access' in (r.json or {}),
                     f'{r.status} {r.body[:200]}'):
            sys.exit('Sem login do admin não dá para continuar.')
        self.tokens['ADM'] = r.json['access']
        self.admin_refresh = r.json['refresh']

        access = self.tokens['ADM']
        h, b, s = access.split('.')
        forged = f'{h}.{b}.{s[::-1]}'
        r = request('GET', self.api + '/auth/me/', token=forged)
        check('JWT com assinatura adulterada -> 401', r.status == 401)
        r = request('GET', self.api + '/auth/me/', token=self.admin_refresh)
        check('Refresh token não serve como access -> 401', r.status == 401)

    # D. Autorização (RBAC) ----------------------------------------------
    def authorization(self):
        section('D. Autorização por perfil (RBAC)')
        pwd = 'Bb#' + uuid.uuid4().hex[:12]
        for role in ('GERENTE', 'GARCOM', 'COZINHA', 'CAIXA', 'RECEPCAO'):
            email = f'{self.tag}-{role.lower()}@teste.com'
            r = self.call('POST', '/users/', {'name': f'{self.tag} {role}', 'email': email, 'role': role,
                                              'password': pwd, 'password_confirm': pwd}, role='ADM')
            check(f'Admin cria usuário {role}', r.status == 201, f'{r.status} {r.body[:150]}')
            self.users[role] = (r.json or {}).get('id')
            check(f'Cadastro de {role} devolve o id', isinstance(self.users[role], int))
            r = self.call('POST', '/auth/login/', {'email': email, 'password': pwd})
            self.tokens[role] = (r.json or {}).get('access')
        self.pwd = pwd

        r = self.call('POST', '/users/', {'name': 'x', 'email': f'{self.tag}-weak@teste.com', 'role': 'GARCOM',
                                          'password': '123456', 'password_confirm': '123456'}, role='ADM')
        check('Senha fraca (123456) recusada no cadastro', r.status == 400)

        denied = [
            ('GARCOM', 'GET', '/dashboard/'), ('GARCOM', 'GET', '/users/'), ('GARCOM', 'GET', '/audit/'),
            ('GARCOM', 'GET', '/cash-register/registers/'), ('GARCOM', 'GET', '/fiscal/settings/'),
            ('COZINHA', 'POST', '/orders/'), ('COZINHA', 'GET', '/cash-register/payments/'),
            ('CAIXA', 'GET', '/dashboard/'), ('CAIXA', 'POST', '/menu/items/'),
            ('RECEPCAO', 'GET', '/reports/sales-by-waiter/'), ('GERENTE', 'POST', '/users/'),
            ('GERENTE', 'GET', '/dashboard/'),
        ]
        for role, m, path in denied:
            check(f'{role} bloqueado em {m} {path}', self.call(m, path, {}, role=role).status == 403)

        gid = self.users['GARCOM']
        r = self.call('PATCH', f'/users/{gid}/', {'role': 'ADM_MAXIMO'}, role='GARCOM')
        check('Garçom não se promove a ADM (escalada de privilégio)', r.status == 403)
        r = self.call('POST', f'/users/{self.users["CAIXA"]}/change_password/',
                      {'new_password': 'Outra#Senha99', 'new_password_confirm': 'Outra#Senha99'}, role='GARCOM')
        check('Garçom não troca senha de outro usuário (IDOR)', r.status == 403, str(r.status))
        r = self.call('POST', '/users/abc/change_password/', {}, role='ADM')
        check('Id inválido na URL -> 404, sem erro 500', r.status == 404, str(r.status))
        r = self.call('GET', '/users/me/', role='GARCOM')
        check('Resposta de usuário nunca expõe hash de senha', r.status == 200 and 'password' not in (r.json or {}))

    # E. Entrada maliciosa -----------------------------------------------
    def injection(self):
        section('E. Validação de entrada / injeção')
        for payload in ("' OR '1'='1", "1; DROP TABLE orders_order; --", '%27%22%3E', '../../../etc/passwd'):
            r = self.call('GET', '/orders/?search=' + urllib.request.quote(payload), role='ADM')
            check(f'search={payload[:22]!r} sem erro 500', r.status in (200, 400), str(r.status))
        r = self.call('GET', '/orders/?status=' + urllib.request.quote("x' OR 1=1--"), role='ADM')
        check('Filtro com SQLi -> 400/vazio, sem 500',
              r.status == 400 or (r.status == 200 and (r.json or {}).get('count', 0) == 0), str(r.status))

        xss = '<script>alert(1)</script><img src=x onerror=alert(2)>'
        r = self.call('POST', '/queue/', {'customer_name': xss, 'people_count': 2}, role='RECEPCAO')
        ok = r.status == 201 and (r.json or {}).get('customer_name') == xss \
            and 'application/json' in (r.h('Content-Type') or '')
        check('XSS armazenado volta como texto JSON (React escapa ao exibir)', ok, f'{r.status}')
        if r.status == 201:
            self.call('POST', f'/queue/{r.json["id"]}/cancel/', role='RECEPCAO')

        r = self.call('POST', '/auth/login/', raw=b'{"email":"' + b'a' * (3 * 1024 * 1024) + b'"}')
        check('Corpo de 3 MB recusado (400/413, sem processar)', r.status in (400, 413), str(r.status))
        r = self.call('POST', '/queue/', {'customer_name': 'x', 'people_count': -5}, role='RECEPCAO')
        check('Quantidade negativa de pessoas recusada', r.status == 400, str(r.status))
        r = self.call('POST', '/menu/items/', {'name': 'x', 'price': '-10.00', 'sector': 'BAR', 'sku': self.tag},
                      role='ADM')
        check('Preço negativo recusado', r.status == 400, str(r.status))

        r = request('OPTIONS', self.api + '/orders/', headers={
            'Origin': 'https://site-malicioso.com', 'Access-Control-Request-Method': 'GET'})
        check('CORS não libera origem desconhecida', r.h('Access-Control-Allow-Origin') is None)
        r = request('TRACE', self.api + '/orders/')
        check('Método TRACE não aceito', r.status in (401, 403, 405, 501), str(r.status))

    # E2. Fuzzing: lixo em todos os endpoints de escrita -> nunca 5xx ----------
    def fuzz(self):
        section('E2. Fuzzing (payloads inválidos em endpoints de escrita)')
        r = self.call('GET', '/tables/?status=LIVRE', role='ADM')
        tables = (r.json or {}).get('results', [])
        tid = tables[0]['id'] if tables else 1
        r = self.call('POST', '/orders/', {'table': tid}, role='ADM')
        oid = (r.json or {}).get('id', 1)
        r = self.call('POST', '/queue/', {'customer_name': 'fuzz', 'people_count': 1}, role='ADM')
        qid = (r.json or {}).get('id', 1)

        targets = [
            ('POST', '/orders/'), ('POST', f'/orders/{oid}/add_item/'), ('POST', f'/orders/{oid}/update_status/'),
            ('POST', f'/orders/{oid}/transfer-table/'), ('POST', f'/orders/{oid}/transfer-items/'),
            ('PATCH', f'/orders/{oid}/'), ('DELETE', f'/orders/{oid}/items/abc/'),
            ('POST', f'/tables/{tid}/status/'), ('POST', '/tables/'),
            ('POST', '/queue/'), ('PATCH', f'/queue/{qid}/edit/'), ('POST', '/queue/call_next/'),
            ('POST', f'/queue/{qid}/assign-table/'), ('POST', '/menu/items/'), ('POST', '/menu/categories/'),
            ('POST', '/users/'), ('POST', '/cash-register/payments/'), ('POST', '/cash-register/registers/'),
            ('PUT', '/fiscal/settings/'), ('PUT', '/printing/settings/'), ('POST', '/printing/printers/'),
            ('PATCH', '/kitchen/items/999999/status/'), ('POST', '/auth/refresh/'), ('POST', '/auth/logout/'),
            ('GET', '/reports/sales-by-waiter/?month=abc'), ('GET', '/reports/item-ranking/?month=2026-13'),
            ('GET', '/orders/?page=abc'), ('GET', '/orders/?page=-1'), ('GET', '/orders/?ordering=;drop'),
        ]
        junk = [
            {}, [], 'string', 12345, None,
            {'table': 'abc', 'status': 'X' * 5000, 'amount': 'NaN', 'quantity': '1e309', 'items': 'abc',
             'menu_item': {'$gt': ''}, 'target_order': [1], 'group': None, 'order': -1, 'number': 'um'},
            {'name': '\u0000\ud83d\ude00' * 50, 'email': 'not-an-email', 'role': 'DEUS',
             'price': '1' * 400, 'initial_amount': '-0', 'customer_name': ['a'], 'people_count': 'NaN'},
        ]
        server_errors = []
        for method, path in targets:
            for body in junk:
                raw = json.dumps(body).encode()
                r = self.call(method, path, role='ADM', raw=raw) if method != 'GET' else self.call('GET', path, role='ADM')
                if r.status >= 500:
                    server_errors.append(f'{method} {path} {raw[:60]!r} -> {r.status}')
        check(f'{len(targets) * len(junk)} requisições malformadas sem nenhum 5xx', not server_errors,
              '; '.join(server_errors[:6]))
        self.call('DELETE', f'/orders/{oid}/', role='ADM')
        self.call('POST', f'/queue/{qid}/cancel/', role='ADM')

    # F. Fluxo de negócio ponta a ponta ----------------------------------
    def business_flow(self):
        section('F. Fluxo completo: mesa -> pedido -> cozinha -> conta -> caixa')
        r = self.call('GET', '/cash-register/registers/current/', role='CAIXA')
        if r.status == 404:
            r = self.call('POST', '/cash-register/registers/', {'initial_amount': '100.00'}, role='CAIXA')
            check('Caixa abre o caixa do dia', r.status == 201, f'{r.status} {r.body[:150]}')
        else:
            check('Caixa do dia já aberto', r.status == 200)

        num = 900 + int(uuid.uuid4().hex[:2], 16) % 99
        r = self.call('POST', '/tables/', {'number': num, 'seats': 4}, role='ADM')
        if r.status != 201:
            r = self.call('GET', f'/tables/?seats=4', role='ADM')
            table = next(t for t in r.json['results'] if t['status'] == 'LIVRE')
        else:
            table = r.json
        check('Mesa disponível para o teste', bool(table))

        items = self.call('GET', '/menu/items/?is_active=true', role='GARCOM').json['results']
        dish = next((i for i in items if i['sector'] in ('COZINHA', 'PARRILLA')), items[0])

        r = self.call('POST', '/orders/', {'table': table['id'], 'people_count': 2}, role='GARCOM')
        check('Garçom abre comanda na mesa', r.status == 201, f'{r.status} {r.body[:150]}')
        oid = r.json['id']
        r = self.call('POST', f'/orders/{oid}/add_item/', {'menu_item': dish['id'], 'quantity': 2}, role='GARCOM')
        check('Garçom lança 2x item do cardápio', r.status == 201)
        item_id = r.json['id']
        r = self.call('POST', f'/orders/{oid}/add_item/',
                      {'product_name': 'Grátis', 'unit_price': '0.01', 'sector': 'BAR'}, role='GARCOM')
        check('Item fora do cardápio (preço inventado) recusado', r.status == 400)

        sector_role = 'COZINHA' if dish['sector'] == 'COZINHA' else 'ADM'
        r = self.call('GET', '/kitchen/orders/', role=sector_role)
        check('Pedido aparece no painel de preparo', r.status == 200 and str(oid) in r.body.decode())
        r = self.call('PATCH', f'/kitchen/items/{item_id}/status/', {'status': 'PRONTO'}, role=sector_role)
        check('Preparo marca item como PRONTO', r.status == 200, f'{r.status} {r.body[:150]}')

        r = self.call('POST', f'/orders/{oid}/update_status/', {'status': 'FINALIZADO'}, role='GARCOM')
        check('Garçom NÃO finaliza conta sem passar pelo caixa', r.status == 403)
        r = self.call('POST', f'/orders/{oid}/close_bill/', role='GARCOM')
        check('Garçom fecha a conta (vai pro caixa)', r.status == 200 and r.json['status'] == 'FECHAMENTO')
        r = self.call('POST', f'/orders/{oid}/add_item/', {'menu_item': dish['id'], 'quantity': 1}, role='GARCOM')
        check('Conta fechada não aceita novos itens', r.status == 400)

        r = self.call('GET', '/cash-register/registers/pending-orders/', role='CAIXA')
        check('Conta aparece em evidência no caixa', any(o['id'] == oid for o in r.json))
        total = self.call('GET', f'/orders/{oid}/', role='CAIXA').json['total_amount']
        for bad in ('0', '-10.00'):
            r = self.call('POST', '/cash-register/payments/',
                          {'order': oid, 'amount': bad, 'payment_method': 'DINHEIRO'}, role='CAIXA')
            check(f'Pagamento de R$ {bad} recusado', r.status == 400, str(r.status))
        r = self.call('POST', '/cash-register/payments/',
                      {'order': oid, 'amount': total, 'payment_method': 'PIX'}, role='GARCOM')
        check('Garçom não registra pagamento', r.status == 403)
        r = self.call('POST', '/cash-register/payments/',
                      {'order': oid, 'amount': total, 'payment_method': 'PIX'}, role='CAIXA')
        check('Caixa registra o pagamento da conta', r.status == 201, f'{r.status} {r.body[:200]}')
        r = self.call('GET', f'/orders/{oid}/', role='CAIXA')
        check('Comanda FINALIZADA após quitação', r.json['status'] == 'FINALIZADO', r.json['status'])
        r = self.call('POST', f'/orders/{oid}/update_status/', {'status': 'CANCELADO'}, role='CAIXA')
        check('Conta paga não pode ser cancelada', r.status == 400)
        r = self.call('GET', f'/audit/?entity=Order', role='ADM')
        check('Ações ficaram registradas na auditoria', r.status == 200 and r.json.get('count', 0) > 0)

    # G. Carga e balanceamento -------------------------------------------
    def load(self):
        section(f'G. Carga: {self.args.load} requisições, 25 em paralelo')
        roles = [r for r in self.tokens if self.tokens[r]]
        paths = ['/orders/', '/tables/', '/menu/items/', '/queue/']

        def hit(i):
            role = roles[i % len(roles)]
            t0 = time.perf_counter()
            r = self.call('GET', paths[i % len(paths)], role=role)
            return r.status, (time.perf_counter() - t0) * 1000

        t0 = time.perf_counter()
        with ThreadPoolExecutor(25) as ex:
            res = list(ex.map(hit, range(self.args.load)))
        elapsed = time.perf_counter() - t0
        lat = sorted(ms for _, ms in res)
        errors = [s for s, _ in res if s >= 500 or s == 0]
        p95 = lat[int(len(lat) * 0.95) - 1]
        print(f'    {len(res) / elapsed:.0f} req/s · p50 {statistics.median(lat):.0f} ms · p95 {p95:.0f} ms')
        check('Nenhum erro 5xx sob carga', not errors, f'{len(errors)} erros')
        check('p95 abaixo de 1,5 s', p95 < 1500, f'{p95:.0f} ms')

    # H. Força bruta (por último: bloqueia o login deste IP por 1 min) -------
    def bruteforce(self):
        section('H. Força bruta no login')
        codes = [self.call('POST', '/auth/login/', {'email': f'{self.tag}-{i}@x.com', 'password': 'x'}).status
                 for i in range(15)]
        check('Login bloqueado (429) após tentativas seguidas', 429 in codes, str(codes))
        r = self.call('POST', '/auth/logout/', {'refresh': self.admin_refresh}, role='ADM')
        r = self.call('POST', '/auth/refresh/', {'refresh': self.admin_refresh})
        check('Refresh revogado no logout não funciona mais', r.status in (401, 429), str(r.status))

    def cleanup(self):
        for role, uid in self.users.items():
            if uid:
                self.call('DELETE', f'/users/{uid}/', role='ADM')

    def run(self):
        steps = [self.transport, self.disclosure, self.authentication, self.authorization,
                 self.injection, self.fuzz, self.business_flow, self.load, self.bruteforce]
        try:
            for step in steps:
                step()
        finally:
            self.cleanup()


def main():
    global CTX
    ap = argparse.ArgumentParser()
    ap.add_argument('base')
    ap.add_argument('--admin', required=True)
    ap.add_argument('--password', required=True)
    ap.add_argument('--insecure', action='store_true')
    ap.add_argument('--http')
    ap.add_argument('--db-host')
    ap.add_argument('--admin-path')
    ap.add_argument('--load', type=int, default=400)
    args = ap.parse_args()
    if args.insecure:
        CTX = ssl._create_unverified_context()

    BlackBox(args.base, args).run()

    failed = [r for r in RESULTS if not r[1]]
    print(f'\n{len(RESULTS) - len(failed)}/{len(RESULTS)} verificações passaram.')
    for name, _, detail in failed:
        print(f'  ✗ {name}  {detail}')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
