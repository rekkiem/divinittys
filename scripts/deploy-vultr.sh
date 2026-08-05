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

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️ ${NC} $1"; }

cd "$APP_DIR"

# Verificar .env.production existe y no tiene __CHANGE_ME__
if [ ! -f ".env.production" ]; then
  echo -e "${RED}❌ Falta .env.production — copia y completa el archivo${NC}"
  exit 1
fi

if grep -q "__CHANGE_ME__" .env.production; then
  echo -e "${RED}❌ .env.production tiene valores pendientes de cambio${NC}"
  grep "__CHANGE_ME__" .env.production
  exit 1
fi
log ".env.production válido"

# ── Pull imagen/código actualizado ───────────────────────────
echo ""
echo "📥 Actualizando código..."
git pull origin main 2>/dev/null || warn "No se pudo hacer git pull (continúa igual)"

# ── Build de la imagen ────────────────────────────────────────
echo ""
echo "🏗️  Building Docker image..."
$COMPOSE build app --no-cache

# ── Levantar infraestructura primero ─────────────────────────
echo ""
echo "🚀 Levantando servicios..."
$COMPOSE up -d postgres redis meilisearch minio
echo "   Esperando que los servicios estén healthy..."
sleep 20

# ── Migraciones ───────────────────────────────────────────────
echo ""
echo "🗃️  Ejecutando migraciones Prisma..."
$COMPOSE run --rm app sh -c "npx prisma migrate deploy"
log "Migraciones aplicadas"

# ── Seed (solo primera vez) ───────────────────────────────────
if [ "$FIRST_TIME" = "--first-time" ]; then
  echo ""
  echo "🌱 Cargando datos iniciales..."
  $COMPOSE run --rm app sh -c "npx tsx prisma/seed.ts"
  log "Seed completado — admin@divinittys.cl / Admin123!@#"

  echo ""
  echo "🪣 Configurando MinIO..."
  $COMPOSE run --rm app sh -c "npx tsx scripts/setupMinio.ts" || warn "MinIO setup parcial"

  echo ""
  echo "🔍 Indexando Meilisearch..."
  $COMPOSE run --rm app sh -c "npx tsx scripts/reindex-search.ts" || warn "Indexación omitida (sin productos)"
fi

# ── Deploy app + nginx ────────────────────────────────────────
echo ""
echo "🌐 Desplegando app y nginx..."
$COMPOSE up -d app nginx certbot
log "Todos los servicios levantados"

# ── Verificación final ────────────────────────────────────────
echo ""
echo "🔍 Verificando estado..."
sleep 10
$COMPOSE ps

echo ""
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
echo ""
echo "  Comandos útiles:"
echo "  docker compose -f docker-compose.prod.yml logs -f app"
echo "  docker compose -f docker-compose.prod.yml ps"
echo "  bash scripts/deploy-vultr.sh   # redeploy rápido"
echo "════════════════════════════════════════════════════"
