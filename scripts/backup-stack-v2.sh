#!/usr/bin/env bash
# ============================================================
# DIVINITTYS + OpenClaw — Backup completo para migracion VPS
# Uso: bash scripts/backup-stack-v2.sh
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/$STAMP"
OPENCLAW_HOME="${OPENCLAW_HOME:-/home/openclaw/.openclaw}"

cd "$APP_DIR"
mkdir -p "$OUT"

set -a
# shellcheck disable=SC1090
source <(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$ENV_FILE" 2>/dev/null | sed 's/\r$//') || true
set +a
POSTGRES_USER="${POSTGRES_USER:-divinittys}"
POSTGRES_DB="${POSTGRES_DB:-divinittys}"

echo "Backup completo -> $OUT"
echo "  stamp=$STAMP  host=$(hostname)"

# 1. Postgres dump
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps postgres 2>/dev/null | grep -qE 'Up|running|healthy'; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT/postgres.sql.gz"
  echo "  OK postgres.sql.gz ($(du -h "$OUT/postgres.sql.gz" | cut -f1))"
else
  CN=$(docker ps --format '{{.Names}}' | grep -E 'divinittys_db|divinittys_postgres' | head -1 || true)
  if [[ -n "$CN" ]]; then
    docker exec -i "$CN" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT/postgres.sql.gz"
    echo "  OK postgres.sql.gz via $CN ($(du -h "$OUT/postgres.sql.gz" | cut -f1))"
  else
    echo "  WARN postgres no esta up"
  fi
fi

# 2. .env.production
if [[ -f "$ENV_FILE" ]]; then
  cp "$ENV_FILE" "$OUT/env.production.backup"
  chmod 600 "$OUT/env.production.backup"
  echo "  OK env.production.backup"
else
  echo "  WARN $ENV_FILE no encontrado"
fi

# 3. Volumenes Docker
VOL_PATTERNS="postgres_data redis_data meili_data minio_data certbot_conf certbot_www"
docker volume ls --format '{{.Name}}' > "$OUT/volumes-all.txt" || true
docker volume ls --format '{{.Name}}' | grep -iE 'divinittys|postgres|redis|meili|minio|certbot' > "$OUT/volumes-project.txt" || true
echo "  OK volumes-*.txt"

for pattern in $VOL_PATTERNS; do
  VOL=$(docker volume ls -q | grep -E "${pattern}$" | head -1 || true)
  if [[ -n "$VOL" ]]; then
    docker run --rm -v "${VOL}":/data -v "$OUT":/backup alpine \
      tar czf "/backup/${pattern}.tar.gz" -C /data . 2>/dev/null \
      && echo "  OK ${pattern}.tar.gz ($(du -h "$OUT/${pattern}.tar.gz" | cut -f1))" \
      || echo "  WARN fallo tar ${VOL}"
  else
    echo "  skip ${pattern}"
  fi
done

# 4. Codigo app (sin node_modules / .next / backups)
echo "  empaquetando codigo app..."
tar czf "$OUT/app-code.tar.gz" \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./backups' \
  --exclude='./tsconfig.tsbuildinfo' \
  --exclude='./.git' \
  -C "$APP_DIR" . 2>/dev/null \
  && echo "  OK app-code.tar.gz ($(du -h "$OUT/app-code.tar.gz" | cut -f1))" \
  || echo "  WARN app-code.tar.gz fallo"

if [[ -d "$APP_DIR/.git" ]]; then
  tar czf "$OUT/app-git.tar.gz" -C "$APP_DIR" .git 2>/dev/null \
    && echo "  OK app-git.tar.gz ($(du -h "$OUT/app-git.tar.gz" | cut -f1))" || true
fi

# 5. OpenClaw — probar varias rutas posibles
pack_openclaw() {
  local src="$1"
  local label="$2"
  if [[ -d "$src" ]]; then
    tar czf "$OUT/${label}.tar.gz" \
      --exclude='*.log' \
      --exclude='gateway.log' \
      --exclude='*.tmp' \
      --exclude='cache/*' \
      -C "$(dirname "$src")" "$(basename "$src")" 2>/dev/null \
      && echo "  OK ${label}.tar.gz from $src ($(du -h "$OUT/${label}.tar.gz" | cut -f1))" \
      || echo "  WARN ${label} fallo"
  fi
}

pack_openclaw "$OPENCLAW_HOME" "openclaw"
if [[ "$OPENCLAW_HOME" != "/root/.openclaw" ]]; then
  pack_openclaw "/root/.openclaw" "openclaw-root"
fi

if [[ -f /etc/systemd/system/openclaw.service ]]; then
  cp /etc/systemd/system/openclaw.service "$OUT/openclaw.service"
  echo "  OK openclaw.service"
elif systemctl cat openclaw.service >/dev/null 2>&1; then
  systemctl cat openclaw.service > "$OUT/openclaw.service" 2>/dev/null && echo "  OK openclaw.service"
fi

# 6. system-state (no aborta si openclaw falla)
{
  echo "=== hostname ==="
  hostname
  echo "=== openclaw cron ==="
  (command -v openclaw >/dev/null && openclaw cron list) 2>&1 || echo "(openclaw cron no disponible)"
  echo "=== crontab root ==="
  crontab -l 2>/dev/null || true
  echo "=== systemctl enabled ==="
  systemctl list-unit-files --state=enabled 2>/dev/null | grep -E 'docker|nginx|caddy|openclaw|fail2ban|certbot' || true
  echo "=== docker containers ==="
  docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' 2>/dev/null || true
  echo "=== packages ==="
  dpkg -l 2>/dev/null | grep -E 'nginx|caddy|postfix|docker|certbot|fail2ban' || true
} > "$OUT/system-state.txt" 2>&1 || true
echo "  OK system-state.txt"

# 7. certs host (opcional)
if [[ -d /etc/letsencrypt/live ]]; then
  tar czf "$OUT/letsencrypt.tar.gz" -C /etc letsencrypt 2>/dev/null \
    && echo "  OK letsencrypt.tar.gz ($(du -h "$OUT/letsencrypt.tar.gz" | cut -f1))" || true
fi

# 8. MANIFEST
{
  echo "stamp=$STAMP"
  echo "host=$(hostname)"
  echo "app_dir=$APP_DIR"
  echo "openclaw_home=$OPENCLAW_HOME"
  date -u +"utc=%Y-%m-%dT%H:%M:%SZ"
  git -C "$APP_DIR" rev-parse HEAD 2>/dev/null | sed 's/^/git=/' || true
  git -C "$APP_DIR" branch --show-current 2>/dev/null | sed 's/^/branch=/' || true
  echo "--- files ---"
  ls -lh "$OUT"
} > "$OUT/MANIFEST.txt"

echo ""
echo "Backup listo: $OUT"
echo "Tamano total: $(du -sh "$OUT" | cut -f1)"
echo ""
echo "Siguiente: subir a B2"
echo "  rclone copy $OUT b2div:divinittys/migration/$STAMP --progress"
