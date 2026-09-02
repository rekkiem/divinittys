#!/usr/bin/env bash
# ============================================================
# DIVINITTYS + OpenClaw — Restore completo tras migración VPS
# Uso:
#   bash scripts/restore-stack-v2.sh /ruta/al/backup/YYYYMMDD-HHMMSS
# ============================================================
set -euo pipefail

BACKUP_PATH="${1:-}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
OPENCLAW_HOME="${OPENCLAW_HOME:-/home/openclaw/.openclaw}"

[[ -n "$BACKUP_PATH" && -d "$BACKUP_PATH" ]] || {
  echo "Uso: bash scripts/restore-stack-v2.sh /ruta/backup/STAMP"
  echo "Ejemplo: bash scripts/restore-stack-v2.sh /root/migration/20260901-153000"
  exit 1
}

cd "$APP_DIR"
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

echo "♻️  Restore desde $BACKUP_PATH"
echo "   APP_DIR=$APP_DIR"

# ── 1. Restaurar .env ───────────────────────────────────────
if [[ ! -f "$ENV_FILE" && -f "$BACKUP_PATH/env.production.backup" ]]; then
  cp "$BACKUP_PATH/env.production.backup" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "  ✓ $ENV_FILE restaurado desde backup"
elif [[ -f "$ENV_FILE" ]]; then
  echo "  · $ENV_FILE ya existe (no se sobrescribe)"
else
  echo "  ⚠ No hay .env.production ni backup de env"
fi

# ── 2. Restaurar código de la app (si viene en el backup) ────
if [[ -f "$BACKUP_PATH/app-code.tar.gz" ]]; then
  echo "  → restaurando app-code.tar.gz..."
  tar xzf "$BACKUP_PATH/app-code.tar.gz" -C "$APP_DIR" --exclude='./.env.production' 2>/dev/null \
    && echo "  ✓ código app restaurado" || echo "  ⚠ app-code tar tuvo warnings"
fi

if [[ -f "$BACKUP_PATH/app-git.tar.gz" && ! -d "$APP_DIR/.git" ]]; then
  tar xzf "$BACKUP_PATH/app-git.tar.gz" -C "$APP_DIR" && echo "  ✓ .git restaurado"
fi

# ── 3. Levantar solo Postgres y restaurar dump ──────────────
echo "  → levantando postgres..."
"${COMPOSE[@]}" up -d postgres
echo "     esperando health..."
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-divinittys}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

set -a
source <(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$ENV_FILE" 2>/dev/null | sed 's/\r$//') || true
set +a
POSTGRES_USER="${POSTGRES_USER:-divinittys}"
POSTGRES_DB="${POSTGRES_DB:-divinittys}"

if [[ -f "$BACKUP_PATH/postgres.sql.gz" ]]; then
  echo "  → restaurando postgres.sql.gz..."
  gunzip -c "$BACKUP_PATH/postgres.sql.gz" | \
    "${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" >/dev/null
  echo "  ✓ postgres restaurado"
else
  echo "  ⚠ no hay postgres.sql.gz"
fi

# ── 4. Restaurar volúmenes de datos ──────────────────────────
restore_vol() {
  local pattern="$1"
  local tarfile="$BACKUP_PATH/${pattern}.tar.gz"
  [[ -f "$tarfile" ]] || return 0
  local VOL
  VOL=$(docker volume ls -q | grep -E "${pattern}$" | head -1 || true)
  if [[ -z "$VOL" ]]; then
    echo "  · creando volumen para $pattern..."
    "${COMPOSE[@]}" up -d --no-start 2>/dev/null || true
    VOL=$(docker volume ls -q | grep -E "${pattern}$" | head -1 || true)
  fi
  if [[ -n "$VOL" ]]; then
    docker run --rm -v "${VOL}":/data -v "$BACKUP_PATH":/backup alpine \
      sh -c "cd /data && tar xzf /backup/${pattern}.tar.gz" \
      && echo "  ✓ ${pattern} restaurado en $VOL" \
      || echo "  ⚠ fallo restore ${pattern}"
  else
    echo "  ⚠ no se pudo localizar/crear volumen para $pattern"
  fi
}

"${COMPOSE[@]}" up -d redis meilisearch minio 2>/dev/null || true
sleep 3

for p in postgres_data redis_data meili_data minio_data certbot_conf certbot_www; do
  restore_vol "$p"
done

# ── 5. OpenClaw ─────────────────────────────────────────
if [[ -f "$BACKUP_PATH/openclaw.tar.gz" ]]; then
  echo "  → restaurando OpenClaw..."
  mkdir -p "$(dirname "$OPENCLAW_HOME")"
  tar xzf "$BACKUP_PATH/openclaw.tar.gz" -C "$(dirname "$OPENCLAW_HOME")"
  if id openclaw &>/dev/null; then
    chown -R openclaw:openclaw "$OPENCLAW_HOME" 2>/dev/null || true
  fi
  echo "  ✓ OpenClaw restaurado en $OPENCLAW_HOME"
else
  echo "  ⚠ no hay openclaw.tar.gz — el bot quedará genérico"
fi

if [[ -f "$BACKUP_PATH/openclaw.service" ]]; then
  cp "$BACKUP_PATH/openclaw.service" /etc/systemd/system/openclaw.service
  systemctl daemon-reload
  echo "  ✓ openclaw.service instalado (systemctl enable --now openclaw después)"
fi

# ── 6. Certs host (opcional) ──────────────────────────────
if [[ -f "$BACKUP_PATH/letsencrypt.tar.gz" ]]; then
  tar xzf "$BACKUP_PATH/letsencrypt.tar.gz" -C /etc 2>/dev/null \
    && echo "  ✓ letsencrypt restaurado" || echo "  ⚠ no se pudo escribir /etc/letsencrypt"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Restore de datos terminado"
echo ""
echo "  Siguiente (recomendado):"
echo "  1) Revisar $ENV_FILE (AUTH_URL, NEXT_PUBLIC_APP_URL, etc.)"
echo "  2) bash scripts/deploy.sh --skip-pull"
echo "     o:"
echo "     docker compose -f $COMPOSE_FILE --env-file $ENV_FILE build app"
echo "     docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d"
echo "  3) Reindex Meilisearch:"
echo "     docker compose -f $COMPOSE_FILE --env-file $ENV_FILE --profile tools run --rm importer npx tsx scripts/reindex-search.ts"
echo "  4) systemctl enable --now openclaw (si aplica)"
echo "  5) curl -sk https://TU_IP/api/health"
echo "════════════════════════════════════════════════════════"
