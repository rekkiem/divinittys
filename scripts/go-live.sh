#!/usr/bin/env bash
# ============================================================
# DIVINITTYS — Switch prep → producción (mismo VPS)
#
# Uso:
#   bash scripts/go-live.sh --dry-run          # solo checklist
#   bash scripts/go-live.sh --apply            # aplica cambios + rebuild
#   bash scripts/go-live.sh --apply --with-mp-prod  # exige tokens APP_USR-
#
# Variables:
#   APP_DIR=/opt/divinittys
#   ENV_FILE=.env.production
#   PROD_URL=https://divinittys.cl
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
PROD_URL="${PROD_URL:-https://divinittys.cl}"
PROD_HOST="${PROD_HOST:-divinittys.cl}"
MEDIA_URL="${MEDIA_URL:-https://media.divinittys.cl}"
APPLY=0
WITH_MP_PROD=0
DRY=1

for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1; DRY=0 ;;
    --dry-run) DRY=1; APPLY=0 ;;
    --with-mp-prod) WITH_MP_PROD=1 ;;
    --help|-h)
      sed -n '2,18p' "$0"
      exit 0
      ;;
  esac
done

cd "$APP_DIR"
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}OK${NC}    $1"; }
warn() { echo -e "${YELLOW}WARN${NC}  $1"; }
fail() { echo -e "${RED}FAIL${NC}  $1"; FAILS=$((FAILS+1)); }
FAILS=0

echo "════════════════════════════════════════════════════"
echo "  GO-LIVE  mode=$([ "$APPLY" -eq 1 ] && echo APPLY || echo DRY-RUN)"
echo "  dir=$APP_DIR  prod=$PROD_URL"
echo "════════════════════════════════════════════════════"

[[ -f "$ENV_FILE" ]] || { echo "Falta $ENV_FILE"; exit 1; }

# ── helpers ─────────────────────────────────────────────────
env_get() {
  grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true
}

env_set() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # portable sed (GNU)
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

# ── 1) Checklist lectura (sin secretos) ─────────────────────
echo ""
echo "── 1. Estado actual ──"
APP_URL=$(env_get NEXT_PUBLIC_APP_URL)
NODE_E=$(env_get NODE_ENV)
MP_TOKEN=$(env_get MERCADOPAGO_ACCESS_TOKEN)
MP_PUB=$(env_get MERCADOPAGO_PUBLIC_KEY)
MP_SECRET=$(env_get MERCADOPAGO_WEBHOOK_SECRET)
CRON=$(env_get CRON_SECRET)
GEMINI=$(env_get GEMINI_API_KEY)

echo "  NEXT_PUBLIC_APP_URL=${APP_URL:-(vacío)}"
echo "  NODE_ENV=${NODE_E:-(vacío)}"

if [[ "$MP_TOKEN" == TEST-* ]]; then
  warn "MercadoPago ACCESS_TOKEN = SANDBOX (TEST-)"
elif [[ "$MP_TOKEN" == APP_USR-* ]]; then
  ok "MercadoPago ACCESS_TOKEN = PRODUCCIÓN (APP_USR-)"
elif [[ -n "$MP_TOKEN" ]]; then
  warn "MercadoPago token presente (prefijo desconocido)"
else
  fail "Sin MERCADOPAGO_ACCESS_TOKEN"
fi

if [[ -n "$MP_SECRET" ]]; then
  ok "MERCADOPAGO_WEBHOOK_SECRET configurado"
else
  fail "Falta MERCADOPAGO_WEBHOOK_SECRET (obligatorio en prod)"
fi

[[ -n "$CRON" ]] && ok "CRON_SECRET presente" || warn "CRON_SECRET vacío (cleanup abandonados)"
[[ -n "$GEMINI" ]] && ok "GEMINI_API_KEY presente" || warn "LUNA sin GEMINI_API_KEY"

# DNS rápido
echo ""
echo "── 2. DNS / HTTPS ──"
if command -v dig >/dev/null 2>&1; then
  DIG_IP=$(dig +short "$PROD_HOST" A | head -1 || true)
  echo "  A $PROD_HOST → ${DIG_IP:-(sin dig)}"
else
  DIG_IP=""
  warn "dig no instalado — verifica DNS a mano"
fi

HTTP_PROD=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://${PROD_HOST}/api/health" 2>/dev/null || echo 000)
HTTP_PREP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://prep.divinittys.cl/api/health" 2>/dev/null || echo 000)
echo "  https://$PROD_HOST/api/health → $HTTP_PROD"
echo "  https://prep.divinittys.cl/api/health → $HTTP_PREP"

if [[ "$HTTP_PROD" == "200" ]]; then
  ok "Producción ya responde health 200"
else
  warn "Producción aún no health 200 (DNS/SSL/nginx)"
fi

# Certificados
if docker volume ls -q | grep -q certbot; then
  ok "Volumen certbot presente"
else
  warn "Sin volumen certbot — SSL puede fallar"
fi

# Containers
echo ""
echo "── 3. Contenedores ──"
"${COMPOSE[@]}" ps --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null || "${COMPOSE[@]}" ps

# Disco
echo ""
echo "── 4. Recursos ──"
df -h / | tail -1
free -h | head -2

if [[ "$WITH_MP_PROD" -eq 1 && "$MP_TOKEN" != APP_USR-* ]]; then
  fail "--with-mp-prod requiere MERCADOPAGO_ACCESS_TOKEN=APP_USR-... en $ENV_FILE"
fi

if [[ "$FAILS" -gt 0 && "$APPLY" -eq 1 ]]; then
  echo -e "${RED}Hay $FAILS fallo(s). Corrige antes de --apply (o quita --with-mp-prod).${NC}"
  exit 1
fi

if [[ "$APPLY" -eq 0 ]]; then
  echo ""
  echo "DRY-RUN listo. Cuando quieras aplicar:"
  echo "  1) Edita $ENV_FILE (tokens prod MP, WEBHOOK_SECRET, CRON_SECRET)"
  echo "  2) bash scripts/go-live.sh --apply"
  echo "  3) Opcional cobros reales: bash scripts/go-live.sh --apply --with-mp-prod"
  exit 0
fi

# ── APPLY ───────────────────────────────────────────────────
echo ""
echo "── APPLY: backup + switch ──"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p backups
cp "$ENV_FILE" "backups/env.pre-golive.$STAMP"
chmod 600 "backups/env.pre-golive.$STAMP"
ok "Backup env → backups/env.pre-golive.$STAMP"

# Backup DB rápido
if bash scripts/backup-stack.sh 2>/dev/null; then
  ok "backup-stack ejecutado"
else
  warn "backup-stack falló o no disponible — continúa bajo tu riesgo"
fi

env_set NODE_ENV production
env_set NEXT_PUBLIC_APP_URL "$PROD_URL"
# Domain helpers si existen claves
grep -qE '^DOMAIN=' "$ENV_FILE" && env_set DOMAIN "$PROD_HOST" || true
grep -qE '^MINIO_PUBLIC_URL=' "$ENV_FILE" && env_set MINIO_PUBLIC_URL "$MEDIA_URL" || true

ok "NEXT_PUBLIC_APP_URL=$PROD_URL"
ok "NODE_ENV=production"

echo ""
echo "── Rebuild app (toma URLs de build-time) ──"
"${COMPOSE[@]}" up -d --build app
sleep 12
"${COMPOSE[@]}" up -d nginx 2>/dev/null || true

# Reindex best-effort
if "${COMPOSE[@]}" config --services 2>/dev/null | grep -q '^importer$'; then
  "${COMPOSE[@]}" --profile tools run --rm importer \
    sh -c 'npx tsx scripts/reindex-search.ts' \
    && ok "Meilisearch reindex" || warn "reindex omitido"
fi

# Verify
echo ""
echo "── Verificación ──"
LOCAL=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/api/health 2>/dev/null || echo 000)
PROD=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$PROD_URL/api/health" 2>/dev/null || echo 000)
echo "  local health=$LOCAL  prod health=$PROD"

if [[ "$LOCAL" == "200" ]]; then ok "Health local OK"; else warn "Health local $LOCAL"; fi
if [[ "$PROD" == "200" ]]; then ok "Health $PROD_URL OK"; else warn "Health prod $PROD — revisa DNS/SSL"; fi

echo ""
echo "════════════════════════════════════════════════════"
echo "  GO-LIVE APLICADO"
echo "  Rollback env: cp backups/env.pre-golive.$STAMP $ENV_FILE"
echo "  Luego: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --build app"
echo "════════════════════════════════════════════════════"
echo ""
echo "Pendiente MANUAL (no automatizable):"
echo "  • Dashboard MercadoPago: webhook → $PROD_URL/api/webhooks/mercadopago"
echo "  • back_urls ya usan NEXT_PUBLIC_APP_URL tras rebuild"
echo "  • Probar 1 pago real con monto mínimo si --with-mp-prod"
echo "  • Confirmar media.divinittys.cl sirve imágenes"
