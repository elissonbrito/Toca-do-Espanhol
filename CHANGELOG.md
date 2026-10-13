# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
versionamento conforme [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- Deploy de produção em VM Oracle Always Free (`deploy/`): Caddy com HTTPS automático,
  2 backends balanceados com health check/failover, Postgres interno, backup diário,
  deploy sem downtime, scripts de preparo da VM e de restauração.
- Testes de caixa preta (`deploy/tests/blackbox.py`: TLS, cabeçalhos, RBAC, injeção,
  fuzzing, fluxo completo, carga, força bruta) e de failover (`deploy/tests/failover.py`).
- Matriz de permissões endpoint × perfil e testes de segurança (JWT, throttling, troca de senha).
- Troca de senha pelo próprio usuário; ADM redefine sem a senha antiga. Sessões revogadas na troca/desativação.
- `check_default_passwords` (lista/desativa contas com senha padrão) e `seed_menu --if-empty`.

### Alterado
- Django 5.0 (sem suporte) → 5.2 LTS; DRF, SimpleJWT, gunicorn e demais dependências atualizadas
  (pip-audit sem vulnerabilidades). Pillow e django-extensions removidos (não eram usados).
- Produção: `SECRET_KEY` obrigatória, cookies seguros, HSTS, admin em caminho secreto,
  cache compartilhado (throttling consistente entre workers), limite de corpo 2 MB.
- `seed_data` não cria usuários com senha 123456 fora de `DEBUG=True`.
- Limites de requisição ajustados ao polling das telas (300/min por usuário).
- Banco de produção sai do Render; `DATABASE_URL` passa a ser definida manualmente.

### Corrigido
- Garçom/cozinha conseguiam finalizar ou reabrir conta sem passar pelo caixa.
- Pagamento de valor zero/negativo finalizava a conta.
- Itens podiam ser transferidos de uma conta já paga.
- Erros 500 com id não numérico e com corpo JSON que não é objeto.
- `POST /api/orders/` sem mesa dava erro 500; `/api/users/me/` bloqueado para não-admin.
- Admin do Django com erro 500 em produção (manifesto de estáticos não gerado).
- Download do XML da NFC-e sempre dava 401 (link sem o token).
- IP da auditoria podia ser forjado via `X-Forwarded-For`.
- Testes desatualizados (GTIN de exemplo inválido, permissões antigas).

## [2.0.0] - 2026-08-27

Primeiro release publicado no repositório. Reescrita completa a partir do
protótipo inicial (v1, fase local, sem versionamento). Não há caminho de
migração automática de dados a partir da v1.

### Adicionado
- Backend Django 5 + DRF + PostgreSQL, organizado em 11 apps.
- Autenticação JWT (SimpleJWT): login, refresh, logout com blacklist, `/api/auth/me`.
- Modelo de usuário customizado com 7 perfis (roles) e permissões por perfil.
- Mesas, Pedidos (comanda + itens), Cozinha/Parrilla (fila por setor), Fila de
  senhas com painel público, Caixa (abertura/fechamento + pagamentos), Dashboard
  de indicadores, Auditoria.
- **Cardápio** com classificação fiscal completa (Simples Nacional): origem, NCM,
  CEST, CFOP, CSOSN, CST/alíquota de PIS e COFINS, unidade, GTIN.
- **Conferência fiscal** do catálogo (validação de formato e completude).
- **NFC-e (modelo 65, layout 4.00)**: chave de acesso (44 díg. + DV mód-11),
  geração de XML, QR Code, e cliente SEFAZ plugável (assinatura/transmissão
  ativam ao cadastrar certificado A1 + CSC).
- Snapshot fiscal congelado no item do pedido no momento da venda.
- Frontend React + Vite + Tailwind com todas as telas.
- `render.yaml` (deploy no Render: Postgres + backend + frontend estático).
- Coleção Insomnia/Postman e documentação da API no README.

### Notas
- Requer `ALTER ROLE <db_user> CREATEDB;` para rodar a suíte de testes.
- Transmissão real à SEFAZ depende de certificado A1, IE e CSC do estabelecimento.

## [1.0.0]

Protótipo inicial, desenvolvido localmente e nunca publicado em repositório.
