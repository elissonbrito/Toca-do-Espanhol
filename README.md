# 🍖 Toca do Espanhol — Sistema de Gestão Operacional

Sistema ERP completo para gerenciamento operacional do restaurante Toca do Espanhol, desenvolvido com Django REST Framework + React + TailwindCSS.

---

## 📋 Índice

- [Stack](#stack)
- [Funcionalidades](#funcionalidades)
- [Perfis de Acesso](#perfis-de-acesso)
- [Início Rápido (Docker)](#início-rápido-docker)
- [Desenvolvimento Local](#desenvolvimento-local)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [API Endpoints](#api-endpoints)
- [Credenciais Padrão](#credenciais-padrão)
- [Segurança](#segurança)
- [Produção (VM Oracle Always Free)](#️-produção-vm-oracle-always-free)

---

## 🛠 Stack

**Backend:**
- Python 3.12+
- Django 5.0 + Django REST Framework 3.15
- PostgreSQL 16
- SimpleJWT (autenticação JWT)
- django-cors-headers, django-filter, Gunicorn

**Frontend:**
- React 18 + Vite
- React Router DOM v6
- TailwindCSS 3
- Axios (com interceptors JWT automáticos)
- React Hook Form, React Toastify, Recharts

**Infra:**
- Docker + Docker Compose
- Nginx (frontend em produção)

---

## ✨ Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Auth** | Login JWT, refresh token, logout com blacklist |
| **Usuários** | CRUD com perfis e controle de acesso |
| **Mesas** | Grid visual com status em tempo real |
| **Pedidos** | Abertura de comandas, lançamento de itens, fluxo de status |
| **Cozinha** | Painel Kanban com auto-refresh de 30s |
| **Parrilla** | Painel separado para setor de grelhados |
| **Fila** | Geração de senhas, chamada, painel público |
| **Caixa** | Abertura/fechamento, pagamentos (Dinheiro, PIX, Débito, Crédito) |
| **Dashboard** | Gráficos, KPIs, top produtos, ocupação de mesas |
| **Auditoria** | Log automático de todas as ações críticas |

---

## 👥 Perfis de Acesso

| Perfil | Dashboard | Mesas | Pedidos | Cozinha | Parrilla | Caixa | Usuários |
|--------|:---------:|:-----:|:-------:|:-------:|:--------:|:-----:|:--------:|
| ADM_MAXIMO | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GERENTE | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👀 |
| GARCOM | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| COZINHA | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| PARRILLA | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| CAIXA | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| RECEPCAO | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🚀 Início Rápido (Docker)

### Pré-requisitos
- Docker Desktop instalado
- Docker Compose v2+

```bash
# 1. Clone o repositório
git clone <url>
cd toca-do-espanhol

# 2. Execute o script de start
chmod +x start.sh
./start.sh

# Ou manualmente:
docker-compose up -d --build
```

O sistema ficará disponível em:
- **Frontend:** http://localhost
- **Backend API:** http://localhost:8000/api/
- **Admin Django:** http://localhost:8000/admin/

---

## 💻 Desenvolvimento Local

### Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate    # Windows

# Instalar dependências
pip install -r requirements.txt

# Configurar .env
cp .env.example .env
# Edite .env com suas configurações locais (DB_HOST=localhost)

# Banco de dados
python manage.py migrate
python manage.py seed_data  # Cria usuários e mesas de exemplo
python manage.py seed_menu  # Cria o cardápio de exemplo já classificado fiscalmente

# Rodar servidor (o front e o app mobile já esperam a API em :8001)
python manage.py runserver 8001
```

### Testes

```bash
cd backend
python manage.py test
```

> O runner cria o banco `test_toca_espanhol`, então o usuário do Postgres precisa
> da permissão `CREATEDB`:
> ```sql
> ALTER ROLE tocauser CREATEDB;
> ```
> Suítes: `apps/auth`, `apps/tables`, `apps/orders`, `apps/kitchen`, `apps/queue`,
> `apps/cash_register`, `apps/dashboard`.

Coleção da API para Insomnia/Postman: `docs/toca-espanhol-api.postman_collection.json`.

### Frontend

```bash
cd frontend
npm install

# Crie .env.local se precisar apontar para API diferente:
# VITE_API_URL=http://localhost:8001/api

npm run dev
```

Acesse em http://localhost:5173

---

## 📁 Estrutura do Projeto

```
toca-do-espanhol/
├── backend/
│   ├── apps/
│   │   ├── users/          # Modelo de usuário custom + permissões por role
│   │   ├── auth/           # Login/refresh/logout/me (JWT); label "authn"
│   │   ├── tables/         # Mesas
│   │   ├── orders/         # Pedidos e itens
│   │   ├── queue/          # Fila de senhas
│   │   ├── kitchen/        # Painel cozinha/parrilla
│   │   ├── cash_register/  # Caixa e pagamentos
│   │   ├── menu/           # Cardápio + classificação fiscal (NCM/CEST/CFOP/CSOSN) + conferência
│   │   ├── fiscal/         # NFC-e (modelo 65, XML 4.00, chave de acesso, QR Code, SEFAZ)
│   │   ├── audit/          # Logs de auditoria
│   │   └── dashboard/      # KPIs e estatísticas
│   │   #  cada app: models · serializers · services · views · urls · admin · tests
│   ├── config/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/     # Layout, Sidebar, Navbar
│   │   │   └── ui/         # Componentes reutilizáveis
│   │   ├── context/        # AuthContext
│   │   ├── pages/          # Todas as páginas
│   │   ├── services/       # API (axios)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── start.sh
└── README.md
```

---

## 🔌 API Endpoints

### Autenticação
```
POST   /api/auth/login/     → Login (retorna access + refresh tokens)
POST   /api/auth/refresh/   → Refresh do access token
POST   /api/auth/logout/    → Logout (blacklist do refresh token)
GET    /api/auth/me/        → Dados do usuário logado
```

### Usuários
```
GET    /api/users/          → Listar usuários
POST   /api/users/          → Criar usuário (ADM_MAXIMO)
GET    /api/users/:id/      → Detalhe
PATCH  /api/users/:id/      → Atualizar
DELETE /api/users/:id/      → Desativar
```

> Coluna **Roles**: perfis que podem acessar. `ADM_MAXIMO`/`GERENTE` têm acesso a tudo.

### Mesas
```
GET    /api/tables/            → Listar (filtro por status/lugares)   [autenticado]
POST   /api/tables/            → Criar mesa                           [GERENTE+]
PATCH  /api/tables/:id/        → Editar número/lugares/observação     [GERENTE+]
DELETE /api/tables/:id/        → Remover                              [GERENTE+]
POST   /api/tables/:id/status/ → Trocar status (operacional)          [autenticado]
```

### Pedidos
```
GET    /api/orders/                      → Listar (filtro por status/mesa)  [autenticado]
POST   /api/orders/                      → Abrir comanda                    [GARCOM+]
GET    /api/orders/:id/                  → Detalhe com itens                [autenticado]
POST   /api/orders/:id/add_item/         → Adicionar item                   [GARCOM+]
DELETE /api/orders/:id/items/:item_id/   → Cancelar item                    [GARCOM+]
POST   /api/orders/:id/update_status/    → Alterar status da comanda        [autenticado]
PUT/PATCH/DELETE /api/orders/:id/        → Editar/remover comanda           [GERENTE+]
```

### Cozinha / Parrilla
```
GET    /api/kitchen/orders/?sector=COZINHA   → Itens a preparar (PENDENTE/PREPARANDO)  [COZINHA/PARRILLA]
PATCH  /api/kitchen/items/:id/status/        → Avançar status do item                  [COZINHA/PARRILLA]
```
> Quando todos os itens de uma comanda ficam `PRONTO`, a comanda vira `PRONTO` automaticamente.

### Fila
```
GET    /api/queue/                → Listar senhas          [autenticado]
POST   /api/queue/                → Emitir senha           [RECEPCAO+]
GET    /api/queue/public_display/ → Painel público         [público, sem auth]
POST   /api/queue/call_next/      → Chamar próxima         [RECEPCAO+]
POST   /api/queue/:id/finalize/   → Finalizar              [RECEPCAO+]
POST   /api/queue/:id/cancel/     → Cancelar               [RECEPCAO+]
```

### Caixa
```
GET    /api/cash-register/registers/current/    → Caixa aberto            [CAIXA+]
POST   /api/cash-register/registers/            → Abrir caixa (1 por vez) [CAIXA+]
POST   /api/cash-register/registers/:id/close/  → Fechar (final_amount)   [CAIXA+]
GET    /api/cash-register/registers/:id/report/ → Relatório por método    [CAIXA+]
GET    /api/cash-register/payments/             → Listar pagamentos       [CAIXA+]
POST   /api/cash-register/payments/             → Registrar pagamento     [CAIXA+]
```
> Registrar pagamento finaliza a comanda e manda a mesa para `LIMPEZA`. Exige caixa aberto.

### Cardápio
```
GET    /api/menu/categories/                 → Categorias                     [autenticado]
GET    /api/menu/items/                      → Itens (filtro categoria/setor/csosn) [autenticado]
POST   /api/menu/items/                      → Cadastrar item + dados fiscais [GERENTE+]
PATCH  /api/menu/items/:id/                  → Editar                         [GERENTE+]
GET    /api/menu/items/:id/fiscal_check/     → Conferência fiscal de 1 item   [autenticado]
GET    /api/menu/items/fiscal_report/        → Conferência do catálogo        [GERENTE+]
GET    /api/menu/items/fiscal_choices/       → Opções (origem, CSOSN, CFOP, CST, unidade)
GET    /api/menu/items/ncm_suggestions/      → NCMs sugeridos p/ restaurante
```

### Fiscal — NFC-e (modelo 65, layout 4.00)
```
GET/PUT /api/fiscal/settings/                → Emitente + credenciais (certificado A1, CSC)  [GERENTE+]
GET     /api/fiscal/nfce/                    → NFC-e geradas                  [autenticado]
POST    /api/fiscal/nfce/from-order/:id/     → Gerar rascunho (chave 44 díg. + XML + QR)     [CAIXA+]
POST    /api/fiscal/nfce/:id/sign/           → Assinar (XMLDSig) *            [CAIXA+]
POST    /api/fiscal/nfce/:id/transmit/       → Transmitir à SEFAZ *          [CAIXA+]
GET     /api/fiscal/nfce/:id/xml/            → Baixar o XML                   [autenticado]
```
> \* `sign`/`transmit` exigem certificado A1 + CSC + IE + endpoint da SEFAZ da UF.
> Sem isso, respondem `NAO_CONFIGURADO` com o checklist do que falta — nada é enviado.
> Itens do pedido vinculados ao cardápio congelam NCM/CEST/CFOP/CSOSN/origem no momento da venda.

### Dashboard
```
GET    /api/dashboard/          → KPIs, receita 7 dias, top produtos   [GERENTE+]
```

### Auditoria
```
GET    /api/audit/             → Logs, read-only (filtro por ação/entidade/usuário)  [GERENTE+]
```

---

## 🔑 Credenciais Padrão

Geradas pelo comando `seed_data` **somente em desenvolvimento** (`DEBUG=True`):

| Email | Senha | Perfil |
|-------|-------|--------|
| admin@toca.com | 123456 | ADM_MAXIMO |
| gerente@toca.com | 123456 | GERENTE |
| garcom@toca.com | 123456 | GARCOM |
| cozinha@toca.com | 123456 | COZINHA |
| parrilla@toca.com | 123456 | PARRILLA |
| caixa@toca.com | 123456 | CAIXA |
| recepcao@toca.com | 123456 | RECEPCAO |

> Em produção (`DEBUG=False`) nenhum desses usuários é criado: o admin inicial vem de
> `ADMIN_EMAIL`/`ADMIN_PASSWORD` (senha forte obrigatória). Para achar contas antigas
> ainda com senha padrão: `python manage.py check_default_passwords [--disable]`.

---

## 🔒 Segurança

- Senhas com hash PBKDF2; validação de senha forte no cadastro e na troca
- JWT (access 15 min) com rotação e blacklist do refresh; troca de senha/desativação derruba as sessões
- Login com limite anti força bruta por IP (10/min) e por e-mail (20/h)
- Permissões por perfil em todos os endpoints (testadas numa matriz endpoint × perfil)
- Conta só é finalizada/cancelada/reaberta pelo caixa ou gerência; pagamento precisa ser > 0
- Em produção: `SECRET_KEY` obrigatória, cookies seguros, HSTS, CSP, `X-Frame-Options: DENY`,
  admin do Django em caminho secreto (`ADMIN_URL`), Postgres só na rede interna do Docker
- Contêineres sem root, sistema de arquivos somente leitura e sem capabilities

### Testes

```bash
# Caixa branca (unitários/integração, Postgres)
cd backend && python manage.py test

# Caixa preta (só HTTP, contra qualquer ambiente)
python3 deploy/tests/blackbox.py https://SEU-DOMINIO --admin EMAIL --password SENHA \
  --http http://SEU-DOMINIO --admin-path SEU_ADMIN_URL --db-host IP_DA_VM

# Failover do balanceador (derruba um backend no meio do tráfego)
python3 deploy/tests/failover.py https://SEU-DOMINIO
```

---

## ☁️ Produção (VM Oracle Always Free)

Tudo numa VM gratuita: Caddy (HTTPS automático + frontend + balanceador) → 2 backends
gunicorn → Postgres interno, com backup diário. Arquivos em [`deploy/`](deploy/).

```bash
# 1. Na VM (Ubuntu), uma vez:
git clone <repo> toca-do-espanhol && cd toca-do-espanhol/deploy
bash setup-vm.sh          # Docker, firewall, fail2ban, SSH só com chave, updates automáticos
# 2. No console da Oracle: libere TCP 80/443 e UDP 443 na Security List da VCN.
# 3. Configure e suba:
cp .env.prod.example .env.prod && nano .env.prod
./deploy.sh               # build + migrate + rolling restart (sem downtime)
# 4. (Opcional) Migrar dados de outro Postgres:
./restore.sh arquivo.dump
```

Backups ficam em `deploy/backups/` (7 dias). App mobile: `EXPO_PUBLIC_API_URL=https://SEU-DOMINIO/api`.

---

## 🎨 Design System

**Paleta:**
- Preto: `#0A0A0A` (fundo principal)
- Escuro: `#1A1A1A` (cards)
- Vermelho: `#8B1A1A` (botões primários, destaque)
- Dourado: `#C9A84C` (accent, destaques especiais)
- Branco quente: `#F5F0E8` (texto)

**Tipografia:**
- Display: Playfair Display (títulos, números)
- Body: DM Sans (texto, UI)

---

## 📄 Licença

Desenvolvido para uso interno da Toca do Espanhol.
