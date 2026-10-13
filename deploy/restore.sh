#!/usr/bin/env bash
# Restaura um dump no Postgres de produção (ex.: migração vinda do Render).
#   ./restore.sh caminho/arquivo.dump
# Para gerar o dump do Render (na sua máquina ou na VM):
#   docker run --rm -v "$PWD":/out postgres:17-alpine \
#     pg_dump "EXTERNAL_DATABASE_URL_DO_RENDER" -Fc --no-owner --no-acl -f /out/render.dump
set -euo pipefail
cd "$(dirname "$0")"
dump="$(realpath "$1")"
dc() { docker compose --env-file .env.prod -f docker-compose.prod.yml "$@"; }
set -a; . ./.env.prod; set +a

read -rp "Isto APAGA o banco '$POSTGRES_DB' de produção e restaura '$dump'. Continuar? [digite SIM] " ok
[ "$ok" = "SIM" ] || exit 1

dc stop backend1 backend2
dc up -d db
docker cp "$dump" toca-db-1:/tmp/restore.dump
dc exec -T db sh -c "dropdb -U \$POSTGRES_USER --if-exists \$POSTGRES_DB && createdb -U \$POSTGRES_USER \$POSTGRES_DB && pg_restore -U \$POSTGRES_USER -d \$POSTGRES_DB --no-owner --no-acl /tmp/restore.dump; rm -f /tmp/restore.dump"
./deploy.sh
echo "Restaurado. Confira as senhas padrão no log do 'migrate' acima (check_default_passwords)."
