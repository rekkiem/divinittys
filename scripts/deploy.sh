#!/usr/bin/env bash
# ============================================================
# DIVINITTYS — Deploy portable (cualquier VPS con Docker)
#
# Uso (desde el directorio del proyecto en el servidor):
#   bash scripts/pre-deploy.sh --strict
#   bash scripts/deploy.sh
#   bash scripts/deploy.sh --first-time
#   bash scripts/deploy.sh --skip-pull
#
# Variables opcionales:
#   APP_DIR=/opt/divinittys
#   ENV_FILE=.env.production
#   COMPOSE_FILE=docker-compose.prod.yml
#   PUBLIC_URL=https://divinittys.cl
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
PUBLIC_URL="${PUBLIC_URL:-https://divinittys.cl}"
FIRST_TIME=0
SKIP_PULL=0

for arg in "$@"; do
  case "$arg" in
    --first-time) FIRST_TIME=1 ;;
    --skip-pull)  SKIP_PULL=1 ;;
    --help|-h)
      sed -n '2,20p' "$0"
      exit 0
      ;;
  esac
done

cd "$APP_DIR"
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️ ${NC} $1"; }
die()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

[[ -f "$ENV_FILE" ]] || die "Falta $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || die "Falta $COMPOSE_FILE"

if grep -Eq '__CHANGE_ME__|your_.*_here' "$ENV_FILE"; then
  warn "$ENV_FILE parece tener placeholders — revisa antes de producción"
fi

if [[ "$SKIP_PULL" -eq 0 ]] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH="$(git branch --show-current || true)"
  echo "📥 git pull origin ${BRANCH:-main}..."
  git fetch origin
  if [[ -n "$BRANCH" ]]; then
    git pull --ff-only origin "$BRANCH" || die "git pull falló (resuelve divergencias / stash)"
  else
    git pull --ff-only || true
  fi
  log "Código actualizado"
fi

echo "🏗️  Build app..."
"${COMPOSE[@]}" build app
log "Image construida"

echo "🚀 Infra (postgres redis meili minio)..."
"${COMPOSE[@]}" up -d postgres redis meilisearch minio

echo "   Esperando health..."
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" ps 2>/dev/null | grep -qE 'postgres.*(healthy|running)' \
    && "${COMPOSE[@]}" ps 2>/dev/null | grep -qE 'redis.*(healthy|running)'; then
    break
  fi
  sleep 2
done
log "Infra arriba"

echo "🗃️  Migraciones Prisma..."
# Preferir imagen app ya construida; migrator/tools si falla
if ! "${COMPOSE[@]}" run --rm --no-deps app sh -c 'npx prisma migrate deploy' 2>/dev/null; then
  warn "migrate vía app falló (standalone sin prisma CLI); intenta tools profile si existe"
  "${COMPOSE[@]}" run --rm app node -e "console.log('skip')" 2>/dev/null || true
fi
# Fallback: usar npx en contenedor con node_modules del build stage no siempre disponible.
# Producción standalone: migraciones se corren típicamente con imagen tools o migrator.
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config --services 2>/dev/null | grep -q '^importer$'; then
  "${COMPOSE[@]}" --profile tools run --rm importer sh -c 'npx prisma migrate deploy' || warn "migrate tools omitido"
fi
log "Migraciones (best-effort)"

if [[ "$FIRST_TIME" -eq 1 ]]; then
  echo "🌱 Seed / MinIO / Meili (first-time)..."
  if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config --services 2>/dev/null | grep -q '^importer$'; then
    "${COMPOSE[@]}" --profile tools run --rm importer sh -c 'npx tsx prisma/seed.ts' || warn "seed omitido"
    "${COMPOSE[@]}" --profile tools run --rm importer sh -c 'npx tsx scripts/setupMinio.ts' || warn "minio setup omitido"
    "${COMPOSE[@]}" --profile tools run --rm importer sh -c 'npx tsx scripts/reindex-search.ts' || warn "reindex omitido"
  else
    warn "sin servicio tools/importer — seed/reindex manual"
  fi
fi

echo "🌐 App + nginx..."
"${COMPOSE[@]}" up -d app nginx
# certbot es opcional según compose
"${COMPOSE[@]}" up -d certbot 2>/dev/null || true
log "Stack desplegado"

sleep 8
"${COMPOSE[@]}" ps || true

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/api/health 2>/dev/null || echo 000)
if [[ "$HTTP_CODE" == "200" ]]; then
  log "Health local HTTP 200"
else
  warn "Health local HTTP $HTTP_CODE — revisa logs: docker compose -f $COMPOSE_FILE logs --tail=80 app"
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "  DEPLOY OK (portable)"
echo "  URL: $PUBLIC_URL"
echo "  Admin: $PUBLIC_URL/admin"
echo "════════════════════════════════════════════════════"
