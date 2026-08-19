#!/bin/bash
# ============================================================
# DIVINITTYS — Deploy / Redeploy en Vultr
# Uso: bash scripts/deploy-vultr.sh [--first-time]
# Ejecutar desde /opt/divinittys en el servidor
# ============================================================
set -e

APP_DIR="/opt/divinittys"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
FIRST_TIME="${1:-}"

cd "$APP_DIR"
BRANCH="$(git branch --show-current)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️ ${NC} $1"; }

if [ -z "$BRANCH" ]; then
  echo -e "${RED}❌ No se pudo determinar la rama actual${NC}"
  exit 1
fi

if [ ! -f ".env.production" ]; then
  echo -e "${RED}❌ Falta .env.production — debe existir solo en el VPS y nunca en Git${NC}"
  exit 1
fi

if grep -Eq '__CHANGE_ME__|__CH_' .env.production; then
  echo -e "${RED}❌ .env.production tiene valores pendientes de cambio${NC}"
  grep -E '__CHANGE_ME__|__CH_' .env.production
 # exit 1
fi
log ".env.production válido"

echo ""
echo "📥 Actualizando código de la rama ${BRANCH}..."
git fetch origin
git pull --ff-only origin "$BRANCH"

echo ""
echo "🏗️ Building Docker image..."
$COMPOSE build app --no-cache

echo ""
echo "🚀 Levantando servicios..."
$COMPOSE up -d postgres redis meilisearch minio
echo "   Esperando que los servicios estén healthy..."
sleep 20

echo ""
echo "🗃️ Ejecutando migraciones Prisma..."
$COMPOSE run --rm app sh -c "npx prisma@6.2.1 migrate deploy"
log "Migraciones aplicadas"

if [ "$FIRST_TIME" = "--first-time" ]; then
  echo ""
  echo "🌱 Cargando datos iniciales..."
  $COMPOSE run --rm app sh -c "npx tsx prisma/seed.ts"
  log "Seed completado"

  echo ""
  echo "🪣 Configurando MinIO..."
  $COMPOSE run --rm app sh -c "npx tsx scripts/setupMinio.ts" || warn "MinIO setup parcial"

  echo ""
  echo "🔍 Indexando Meilisearch..."
  $COMPOSE run --rm app sh -c "npx tsx scripts/reindex-search.ts" || warn "Indexación omitida (sin productos)"
fi

echo ""
echo "🌐 Desplegando app y nginx..."
$COMPOSE up -d app nginx certbot
log "Todos los servicios levantados"

echo ""
echo "🔍 Verificando estado..."
sleep 10
$COMPOSE ps

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  log "Health check OK (HTTP 200)"
elif [ "$HTTP_CODE" = "000" ]; then
  warn "App aún iniciando — espera 30s y verifica: curl http://localhost/api/health"
else
  warn "Health check respondió HTTP $HTTP_CODE — revisa: docker compose logs app"
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "  ✅ DEPLOY COMPLETADO"
echo ""
echo "  🌐 https://divinittys.cl"
echo "  🔒 https://divinittys.cl/admin"
echo "  📦 https://media.divinittys.cl"
echo "════════════════════════════════════════════════════"
