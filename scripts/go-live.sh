#!/usr/bin/env bash
# ============================================================
# DIVINITTYS — Switch prep → producción (mismo VPS)
#
# Uso:
#   bash scripts/go-live.sh --dry-run
#   bash scripts/go-live.sh --apply
#   bash scripts/go-live.sh --apply --with-mp-prod
#   bash scripts/go-live.sh --apply --allow-dns-pending  # no bloquea si prod health ≠ 200
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
PROD_URL="${PROD_URL:-https://divinittys.cl}"
PROD_HOST="${PROD_HOST:-divinittys.cl}"
MEDIA_HOST="${MEDIA_HOST:-media.divinittys.cl}"
MEDIA_URL="${MEDIA_URL:-https://media.divinittys.cl}"
PREP_HOST="${PREP_HOST:-prep.divinittys.cl}"
APPLY=0
WITH_MP_PROD=0
ALLOW_DNS_PENDING=0

for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    --with-mp-prod) WITH_MP_PROD=1 ;;
    --allow-dns-pending) ALLOW_DNS_PENDING=1 ;;
    --help|-h) sed -n '2,16p' "$0"; exit 0 ;;
  esac
done

cd "$APP_DIR"
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}OK${NC}    $1"; }
warn() { echo -e "${YELLOW}WARN${NC}  $1"; }
fail() { echo -e "${RED}FAIL${NC}  $1"; FAILS=$((FAILS+1)); }
FAILS=0
SCORE=0
SCORE_MAX=10

echo "════════════════════════════════════════════════════"
echo "  GO-LIVE  mode=$([ "$APPLY" -eq 1 ] && echo APPLY || echo DRY-RUN)"
echo "  dir=$APP_DIR  prod=$PROD_URL"
echo "════════════════════════════════════════════════════"

[[ -f "$ENV_FILE" ]] || { echo "Falta $ENV_FILE"; exit 1; }

env_get() {
  grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/[\r\n]//g' | sed 's/#.*//' | xargs 2>/dev/null || true
}

env_set() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

# IP pública de ESTE VPS
SELF_IP=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null \
  || curl -s --max-time 5 https://api.ipify.org 2>/dev/null \
  || hostname -I 2>/dev/null | awk '{print $1}' \
  || true)

echo ""
echo "── 1. Estado env ──"
APP_URL=$(env_get NEXT_PUBLIC_APP_URL)
NODE_E=$(env_get NODE_ENV)
MP_TOKEN=$(env_get MERCADOPAGO_ACCESS_TOKEN)
MP_PUB=$(env_get MERCADOPAGO_PUBLIC_KEY)
MP_SECRET=$(env_get MERCADOPAGO_WEBHOOK_SECRET)
CRON=$(env_get CRON_SECRET)
GEMINI=$(env_get GEMINI_API_KEY)
TB_ENV=$(env_get TRANSBANK_ENV)
TB_CODE=$(env_get TRANSBANK_COMMERCE_CODE)

echo "  NEXT_PUBLIC_APP_URL=${APP_URL:-(vacío)}"
echo "  NODE_ENV=${NODE_E:-(vacío)}"
echo "  VPS public IP≈ ${SELF_IP:-(desconocida)}"

if [[ "$NODE_E" == "production" ]]; then ok "NODE_ENV=production"; SCORE=$((SCORE+1)); else warn "NODE_ENV no es production"; fi

if [[ "$APP_URL" == "$PROD_URL" ]]; then
  ok "APP_URL ya es prod"
  SCORE=$((SCORE+1))
elif [[ "$APP_URL" == *"prep."* ]]; then
  warn "APP_URL apunta a PREP (esperado hasta --apply)"
else
  warn "APP_URL inusual: $APP_URL"
fi

if [[ "$MP_TOKEN" == TEST-* ]]; then
  warn "MercadoPago ACCESS_TOKEN = SANDBOX (TEST-)"
elif [[ "$MP_TOKEN" == APP_USR-* ]]; then
  ok "MercadoPago ACCESS_TOKEN = PRODUCCIÓN (APP_USR-)"
  SCORE=$((SCORE+1))
elif [[ -n "$MP_TOKEN" ]]; then
  warn "MercadoPago token presente (prefijo desconocido)"
else
  fail "Sin MERCADOPAGO_ACCESS_TOKEN"
fi

if [[ -n "$MP_SECRET" ]]; then ok "MERCADOPAGO_WEBHOOK_SECRET"; SCORE=$((SCORE+1)); else fail "Falta MERCADOPAGO_WEBHOOK_SECRET"; fi
[[ -n "$MP_PUB" ]] && ok "MERCADOPAGO_PUBLIC_KEY presente" || warn "Falta MERCADOPAGO_PUBLIC_KEY"

if [[ -n "$CRON" ]]; then ok "CRON_SECRET"; SCORE=$((SCORE+1)); else warn "CRON_SECRET vacío"; fi
[[ -n "$GEMINI" ]] && ok "GEMINI_API_KEY" || warn "Sin GEMINI (LUNA)"

if [[ "$TB_ENV" == "production" || "$TB_ENV" == "prod" ]]; then
  ok "TRANSBANK_ENV=production"
  SCORE=$((SCORE+1))
elif [[ -n "$TB_ENV" ]]; then
  warn "TRANSBANK_ENV=$TB_ENV (integration/sandbox) — Webpay real pendiente"
else
  warn "TRANSBANK_ENV no definido"
fi
[[ -n "$TB_CODE" ]] && ok "TRANSBANK_COMMERCE_CODE presente" || warn "Sin TRANSBANK_COMMERCE_CODE"

echo ""
echo "── 2. DNS / HTTPS ──"
DIG_IP=""
if command -v dig >/dev/null 2>&1; then
  DIG_IP=$(dig +short "$PROD_HOST" A | grep -E '^[0-9.]+$' | head -1 || true)
  echo "  A $PROD_HOST → ${DIG_IP:-(vacío)}"
else
  warn "dig no instalado"
fi

if [[ -n "$DIG_IP" && -n "$SELF_IP" && "$DIG_IP" == "$SELF_IP" ]]; then
  ok "DNS $PROD_HOST apunta a ESTE VPS ($SELF_IP)"
  SCORE=$((SCORE+1))
elif [[ -n "$DIG_IP" ]]; then
  fail "DNS $PROD_HOST → $DIG_IP pero este VPS ≈ $SELF_IP (no coincide)"
else
  fail "No se resolvió A de $PROD_HOST"
fi

HTTP_PROD=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://${PROD_HOST}/api/health" 2>/dev/null || echo 000)
HTTP_PREP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://${PREP_HOST}/api/health" 2>/dev/null || echo 000)
HTTP_MEDIA=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://${MEDIA_HOST}/" 2>/dev/null || echo 000)
echo "  https://$PROD_HOST/api/health → $HTTP_PROD"
echo "  https://$PREP_HOST/api/health → $HTTP_PREP"
echo "  https://$MEDIA_HOST/ → $HTTP_MEDIA"

if [[ "$HTTP_PROD" == "200" ]]; then ok "Prod health 200"; SCORE=$((SCORE+1)); else fail "Prod health ≠ 200 ($HTTP_PROD)"; fi
if [[ "$HTTP_PREP" == "200" ]]; then ok "Prep health 200"; SCORE=$((SCORE+1)); else warn "Prep health $HTTP_PREP"; fi
if [[ "$HTTP_MEDIA" == "200" || "$HTTP_MEDIA" == "403" || "$HTTP_MEDIA" == "404" ]]; then
  # MinIO root a menudo 403/404; importa que el host resuelva y TLS funcione
  ok "media host responde HTTP $HTTP_MEDIA (TLS up)"
  SCORE=$((SCORE+1))
else
  warn "media host HTTP $HTTP_MEDIA"
fi

if docker volume ls -q | grep -qi certbot; then ok "Volumen certbot"; else warn "Sin volumen certbot"; fi

echo ""
echo "── 3. Contenedores ──"
"${COMPOSE[@]}" ps --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null || "${COMPOSE[@]}" ps
if "${COMPOSE[@]}" ps 2>/dev/null | grep -q 'divinittys_app.*healthy'; then
  ok "app healthy"
  SCORE=$((SCORE+1))
else
  fail "app no healthy"
fi

echo ""
echo "── 4. Recursos ──"
df -h / | tail -1
free -h | head -2

echo ""
echo "── Score readiness: ${SCORE}/${SCORE_MAX} ──"

if [[ "$WITH_MP_PROD" -eq 1 && "$MP_TOKEN" != APP_USR-* ]]; then
  fail "--with-mp-prod requiere MERCADOPAGO_ACCESS_TOKEN=APP_USR-..."
fi

# Bloquear apply si DNS/prod health mal (salvo override)
if [[ "$APPLY" -eq 1 && "$ALLOW_DNS_PENDING" -eq 0 ]]; then
  if [[ "$HTTP_PROD" != "200" ]]; then
    fail "No se puede --apply: prod health ≠ 200. Apunta DNS o usa --allow-dns-pending"
  fi
  if [[ -n "$DIG_IP" && -n "$SELF_IP" && "$DIG_IP" != "$SELF_IP" ]]; then
    fail "No se puede --apply: DNS no apunta a este VPS. Usa --allow-dns-pending solo si sabes lo que haces"
  fi
fi

if [[ "$FAILS" -gt 0 && "$APPLY" -eq 1 ]]; then
  echo -e "${RED}Hay $FAILS fallo(s). Abortando apply.${NC}"
  exit 1
fi

if [[ "$APPLY" -eq 0 ]]; then
  echo ""
  echo "DRY-RUN. Siguiente:"
  echo "  • DNS: A $PROD_HOST + www + media → IP de ESTE VPS (${SELF_IP:-?})"
  echo "  • Cuando health prod=200: bash scripts/go-live.sh --apply"
  echo "  • Cobros reales: tokens APP_USR- + bash scripts/go-live.sh --apply --with-mp-prod"
  echo "  • Override (no recomendado): --allow-dns-pending"
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

bash scripts/backup-stack.sh 2>/dev/null && ok "backup-stack" || warn "backup-stack omitido"

env_set NODE_ENV production
env_set NEXT_PUBLIC_APP_URL "$PROD_URL"
grep -qE '^DOMAIN=' "$ENV_FILE" && env_set DOMAIN "$PROD_HOST" || echo "DOMAIN=$PROD_HOST" >> "$ENV_FILE"
grep -qE '^MINIO_PUBLIC_URL=' "$ENV_FILE" && env_set MINIO_PUBLIC_URL "$MEDIA_URL" || echo "MINIO_PUBLIC_URL=$MEDIA_URL" >> "$ENV_FILE"

if [[ -z "$(env_get CRON_SECRET)" ]]; then
  NEW_CRON=$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | xxd -p | head -c 48)
  env_set CRON_SECRET "$NEW_CRON"
  ok "CRON_SECRET generado"
fi

ok "NEXT_PUBLIC_APP_URL=$PROD_URL"

echo "── Rebuild app ──"
"${COMPOSE[@]}" up -d --build app
sleep 12
"${COMPOSE[@]}" up -d nginx 2>/dev/null || true

if "${COMPOSE[@]}" config --services 2>/dev/null | grep -q '^importer$'; then
  "${COMPOSE[@]}" --profile tools run --rm importer \
    sh -c 'npx tsx scripts/reindex-search.ts' \
    && ok "Meilisearch reindex" || warn "reindex omitido"
fi

LOCAL=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/api/health 2>/dev/null || echo 000)
PROD=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$PROD_URL/api/health" 2>/dev/null || echo 000)
echo "  local=$LOCAL prod=$PROD"
[[ "$LOCAL" == "200" ]] && ok "Health local" || warn "Health local $LOCAL"
[[ "$PROD" == "200" ]] && ok "Health prod" || warn "Health prod $PROD"

echo ""
echo "════════════════════════════════════════════════════"
echo "  GO-LIVE APLICADO"
echo "  Rollback: cp backups/env.pre-golive.$STAMP $ENV_FILE && compose up -d --build app"
echo "════════════════════════════════════════════════════"
echo "Manual pendiente:"
echo "  • MP dashboard webhook → $PROD_URL/api/webhooks/mercadopago"
echo "  • Tokens APP_USR- + Transbank prod cuando tengas keys"
echo "  • Smoke: home, búsqueda, imagen, 1 pago"
