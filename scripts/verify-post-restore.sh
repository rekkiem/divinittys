#!/usr/bin/env bash
# ============================================================
# Verificación post-restore / post-deploy
# Uso: bash scripts/verify-post-restore.sh [BASE_URL]
# ============================================================
set -euo pipefail

BASE_URL="${1:-https://127.0.0.1}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

cd "$APP_DIR"
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }

echo "🔍 Verificación post-restore — $BASE_URL"
echo ""

echo "── Contenedores ──"
"${COMPOSE[@]}" ps --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null || "${COMPOSE[@]}" ps

echo ""
echo "── Health HTTP ──"
CODE=$(curl -sk -o /tmp/health.json -w '%{http_code}' "$BASE_URL/api/health" 2>/dev/null || echo 000)
if [[ "$CODE" == "200" ]]; then
  ok "GET /api/health → 200  $(cat /tmp/health.json 2>/dev/null)"
else
  fail "GET /api/health → $CODE"
fi

echo ""
echo "── Postgres ──"
if "${COMPOSE[@]}" exec -T postgres pg_isready -U divinittys >/dev/null 2>&1; then
  ok "pg_isready"
  COUNT=$("${COMPOSE[@]}" exec -T postgres psql -U divinittys -d divinittys -tAc "SELECT count(*) FROM \"Product\";" 2>/dev/null || echo "?")
  echo "   Product count: $COUNT"
else
  fail "postgres no responde"
fi

echo ""
echo "── Redis ──"
if "${COMPOSE[@]}" exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "redis PONG"
else
  warn "redis no respondió PONG (revisar password)"
fi

echo ""
echo "── Meilisearch ──"
if "${COMPOSE[@]}" exec -T meilisearch curl -sf http://localhost:7700/health >/dev/null 2>&1; then
  ok "meilisearch health"
else
  warn "meilisearch health check falló"
fi

echo ""
echo "── MinIO ──"
if "${COMPOSE[@]}" exec -T minio curl -sf http://localhost:9000/minio/health/live >/dev/null 2>&1; then
  ok "minio live"
else
  warn "minio health falló"
fi

echo ""
echo "── OpenClaw ──"
if [[ -d /home/openclaw/.openclaw ]]; then
  ok "directorio OpenClaw existe"
  ls /home/openclaw/.openclaw/workspace/*.md 2>/dev/null | head -5 || true
else
  fail "falta /home/openclaw/.openclaw — el bot no tiene identidad"
fi

echo ""
echo "── Archivos críticos ──"
[[ -f "$ENV_FILE" ]] && ok "$ENV_FILE" || fail "falta $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] && ok "$COMPOSE_FILE" || fail "falta $COMPOSE_FILE"

echo ""
echo "Listo. Si todo está ✓, podés cambiar DNS."
