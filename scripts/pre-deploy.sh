#!/usr/bin/env bash
# ============================================================
# DIVINITTYS — Pre-deploy (portable, cualquier VPS)
# Uso:
#   bash scripts/pre-deploy.sh
#   bash scripts/pre-deploy.sh --fix
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
STRICT=0
[[ "${1:-}" == "--strict" ]] && STRICT=1

cd "$APP_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}OK${NC}    $1"; }
warn() { echo -e "${YELLOW}WARN${NC}  $1"; }
fail() { echo -e "${RED}FAIL${NC}  $1"; FAILURES=$((FAILURES+1)); }
FAILURES=0

echo "════════════════════════════════════════════════════"
echo "  DIVINITTYS pre-deploy"
echo "  dir: $APP_DIR"
echo "════════════════════════════════════════════════════"

# 1) Tools
command -v docker >/dev/null && ok "docker" || fail "docker no instalado"
docker compose version >/dev/null 2>&1 && ok "docker compose" || fail "docker compose no disponible"
command -v git >/dev/null && ok "git" || fail "git no instalado"
command -v curl >/dev/null && ok "curl" || warn "curl recomendado"

# 2) Files
[[ -f "$COMPOSE_FILE" ]] && ok "$COMPOSE_FILE" || fail "falta $COMPOSE_FILE"
[[ -f Dockerfile ]] && ok "Dockerfile" || fail "falta Dockerfile"
[[ -f "$ENV_FILE" ]] && ok "$ENV_FILE" || fail "falta $ENV_FILE (nunca en git)"

# 3) Env secrets placeholders
if [[ -f "$ENV_FILE" ]]; then
  if grep -Eq '__CHANGE_ME__|__CH_|your_.*_here|CHANGE_ME' "$ENV_FILE"; then
    fail "$ENV_FILE aún tiene placeholders"
    grep -E '__CHANGE_ME__|__CH_|your_.*_here|CHANGE_ME' "$ENV_FILE" | sed 's/=.*/=***/' || true
  else
    ok "$ENV_FILE sin placeholders obvios"
  fi

  for key in POSTGRES_PASSWORD JWT_SECRET JWT_REFRESH_SECRET NEXT_PUBLIC_APP_URL; do
    if grep -q "^${key}=" "$ENV_FILE" && ! grep -q "^${key}=$" "$ENV_FILE"; then
      ok "$key presente"
    else
      fail "$key ausente o vacío"
    fi
  done
fi

# 4) Disk / RAM
if command -v df >/dev/null; then
  AVAIL_GB=$(df -BG "$APP_DIR" 2>/dev/null | awk 'NR==2{gsub(/G/,"",$4); print $4}')
  if [[ -n "${AVAIL_GB:-}" ]] && [[ "$AVAIL_GB" -lt 5 ]]; then
    warn "disco libre ~${AVAIL_GB}G (recomendado ≥10G para build)"
  else
    ok "disco OK (~${AVAIL_GB:-?}G libres)"
  fi
fi
if command -v free >/dev/null; then
  MEM_MB=$(free -m | awk '/Mem:/{print $2}')
  if [[ "${MEM_MB:-0}" -lt 3500 ]]; then
    warn "RAM total ${MEM_MB}MB (recomendado ≥4GB)"
  else
    ok "RAM ${MEM_MB}MB"
  fi
fi

# 5) Git state
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "?")
  ok "rama: $BRANCH"
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    warn "working tree con cambios locales (stash o commit antes de pull)"
  else
    ok "working tree limpio"
  fi
else
  warn "no es un repo git (OK si desplegaste por rsync)"
fi

# 6) Ports (solo aviso)
for p in 80 443 3000; do
  if command -v ss >/dev/null && ss -lntp 2>/dev/null | grep -q ":${p} "; then
    ok "puerto $p en uso (esperado si el stack ya corre)"
  fi
done

echo ""
if [[ "$FAILURES" -gt 0 ]]; then
  echo -e "${RED}Pre-deploy: $FAILURES fallo(s)${NC}"
  if [[ "$STRICT" -eq 1 ]]; then
    exit 1
  fi
  exit 0
fi
echo -e "${GREEN}Pre-deploy: listo para deploy${NC}"
exit 0
