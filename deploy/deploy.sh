#!/usr/bin/env bash
# Sobe/atualiza a produção. Rode na VM, dentro de deploy/.
#   ./deploy.sh            -> build + up (rolling: um backend por vez)
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env.prod ] || { echo "Falta deploy/.env.prod (copie de .env.prod.example)"; exit 1; }
grep -q 'TROQUE' .env.prod && { echo "Há valores 'TROQUE' no .env.prod — preencha antes."; exit 1; }
chmod 600 .env.prod
mkdir -p backups

dc() { docker compose --env-file .env.prod -f docker-compose.prod.yml "$@"; }

dc build
dc up -d db
dc run --rm migrate
# Reinicia um backend por vez: o Caddy manda o tráfego para o outro enquanto isso.
for b in backend1 backend2; do
  dc up -d --no-deps "$b"
  for _ in $(seq 1 30); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' "toca-$b-1" 2>/dev/null)" = healthy ] && break
    sleep 2
  done
done
dc up -d --no-deps web backup
docker image prune -f >/dev/null
dc ps
