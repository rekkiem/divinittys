#!/usr/bin/env bash
# ============================================================
# DIVINITTYS + OpenClaw — Backup completo para migración VPS
# Basado en main (scripts/backup-stack.sh v1) + cobertura total.
#
# Uso:
#   bash scripts/backup-stack-v2.sh
#   BACKUP_DIR=/var/backups/divinittys bash scripts/backup-stack-v2.sh
#
# Incluye:
#   - Postgres dump
#   - .env.production
#   - Volúmenes: postgres, redis, meili, minio, certbot_*
#   - Código app (sin node_modules / .next / backups)
#   - OpenClaw completo (/home/openclaw/.openclaw)
#   - unit openclaw.service si existe
#   - system-state (cron, enabled units)
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

# shellcheck disable=SC1090
set -a
source <(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$ENV_FILE" 2>/dev/null | sed 's/\r$//') || true
set +a
POSTGRES_USER="${POSTGRES_USER:-divinittys}"
POSTGRES_DB="${POSTGRES_DB:-divinittys}"

echo "📦 Backup completo → $OUT"
echo "   stamp=$STAMP  host=$(hostname)"

# ── 1. Postgres dump ─────────────────────────────────────────
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps postgres 2>/dev/null | grep -qE 'Up|running|healthy'; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT/postgres.sql.gz"
  echo "  ✓ postgres.sql.gz ($(du -h "$OUT/postgres.sql.gz" | cut -f1))"
else
  # fallback: contenedor por nombre
  if docker ps --format '{{.Names}}' | grep -q 'divinittys_db\|divinittys_postgres'; then
    CN=$(docker ps --format '{{.Names}}' | grep -E 'divinittys_db|divinittys_postgres' | head -1)
    docker exec -i "$CN" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT/postgres.sql.gz"
    echo "  ✓ postgres.sql.gz via $CN ($(du -h "$OUT/postgres.sql.gz" | cut -f1))"
  else
    echo "  ⚠ postgres no está up — omitiendo dump"
  fi
fi

# ── 2. .env.production (secretos) ────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  cp "$ENV_FILE" "$OUT/env.production.backup"
  chmod 600 "$OUT/env.production.backup"
  echo "  ✓ env.production.backup"
else
  echo "  ⚠ $ENV_FILE no encontrado — ABORTAR si es migración real"
fi

# ── 3. Volúmenes Docker explícitos ───────────────────────────
# Nombres reales medidos en VPS: divinittys_postgres_data, etc.
declare -a VOL_PATTERNS=(
  "postgres_data"
  "redis_data"
  "meili_data"
  "minio_data"
  "certbot_conf"
  "certbot_www"
)

docker volume ls --format '{{.Name}}' > "$OUT/volumes-all.txt" || true
docker volume ls --format '{{.Name}}' | grep -iE 'divinittys|postgres|redis|meili|minio|certbot' > "$OUT/volumes-project.txt" || true
echo "  ✓ volumes-*.txt"

for pattern in "${VOL_PATTERNS[@]}"; do
  VOL=$(docker volume ls -q | grep -E "${pattern}$" | head -1 || true)
  if [[ -n "$VOL" ]]; then
    docker run --rm -v "${VOL}":/data -v "$OUT":/backup alpine \
      tar czf "/backup/${pattern}.tar.gz" -C /data . 2>/dev/null \
      && echo "  ✓ ${pattern}.tar.gz ($(du -h "$OUT/${pattern}.tar.gz" | cut -f1))" \
      || echo "  ⚠ fallo al tar ${VOL}"
  else
    echo "  · volumen ${pattern} no existe (ok)"
  fi
done

# ── 4. Código /opt/divinittys (sin basura pesada) ────────────
# Excluye ~905 MB de node_modules + .next + backups viejos
echo "  → empaquetando código de la app (sin node_modules/.next/backups)..."
tar czf "$OUT/app-code.tar.gz" \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./backups' \
  --exclude='./tsconfig.tsbuildinfo' \
  --exclude='./.git' \
  -C "$APP_DIR" . 2>/dev/null \
  && echo "  ✓ app-code.tar.gz ($(du -h "$OUT/app-code.tar.gz" | cut -f1))" \
  || echo "  ⚠ app-code.tar.gz falló"

# .git por separado (historial local)
if [[ -d "$APP_DIR/.git" ]]; then
  tar czf "$OUT/app-git.tar.gz" -C "$APP_DIR" .git 2>/dev/null \
    && echo "  ✓ app-git.tar.gz ($(du -h "$OUT/app-git.tar.gz" | cut -f1))" || true
fi

# ── 5. OpenClaw (identidad + memoria del bot) — CRÍTICO ──────
if [[ -d "$OPENCLAW_HOME" ]]; then
  echo "  → empaquetando OpenClaw workspace..."
  tar czf "$OUT/openclaw.tar.gz" \
    --exclude='*.log' \
    --exclude='gateway.log' \
    --exclude='*.tmp' \
    --exclude='cache/*' \
    -C "$(dirname "$OPENCLAW_HOME")" "$(basename "$OPENCLAW_HOME")" 2>/dev/null \
    && echo "  ✓ openclaw.tar.gz ($(du -h "$OUT/openclaw.tar.gz" | cut -f1))" \
    || echo "  ⚠ openclaw.tar.gz falló"
else
  echo "  ⚠ $OPENCLAW_HOME no existe — bot no se migrará con identidad"
fi

# Unit systemd de OpenClaw
if [[ -f /etc/systemd/system/openclaw.service ]]; then
  cp /etc/systemd/system/openclaw.service "$OUT/openclaw.service"
  echo "  ✓ openclaw.service"
elif systemctl cat openclaw.service >/dev/null 2>&1; then
  systemctl cat openclaw.service > "$OUT/openclaw.service" 2>/dev/null && echo "  ✓ openclaw.service"
fi

# ── 6. Estado del sistema / cron / servicios ─────────────────{
  echo "=== openclaw cron ==="
  command -v openclaw >/dev/null && openclaw cron list 2>&1 || echo "(openclaw no en PATH o sin jobs)"
  echo ""
  echo "=== crontab root ==="
  crontab -l 2>/dev/null || true
  echo ""
  echo "=== systemctl enabled (filtrado) ==="
  systemctl list-unit-files --state=enabled 2>/dev/null | grep -E 'docker|nginx|caddy|openclaw|fail2ban|certbot' || true
  echo ""
  echo "=== docker containers ==="
  docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' 2>/dev/null || true
  echo ""
  echo "=== paquetes relevantes ==="
  dpkg -l 2>/dev/null | grep -E 'nginx|caddy|postfix|docker|certbot|fail2ban' || true
} > "$OUT/system-state.txt" 2>&1
echo "  ✓ system-state.txt"

# ── 7. Certs host (en este VPS no hay; van en volumen Docker) ─
if [[ -d /etc/letsencrypt/live ]]; then
  tar czf "$OUT/letsencrypt.tar.gz" -C /etc letsencrypt 2>/dev/null \
    && echo "  ✓ letsencrypt.tar.gz ($(du -h "$OUT/letsencrypt.tar.gz" | cut -f1))" || true
fi

# ── 8. MANIFEST ──────────────────────────────────────────
{
  echo "stamp=$STAMP"
  echo "host=$(hostname)"
  echo "app_dir=$APP_DIR"
  echo "openclaw_home=$OPENCLAW_HOME"
  date -u +"utc=%Y-%m-%dT%H:%M:%SZ"
  git -C "$APP_DIR" rev-parse HEAD 2>/dev/null | sed 's/^/git=/' || true
  git -C "$APP_DIR" branch --show-current 2>/dev/null | sed 's/^/branch=/' || true
  echo "--- archivos generados ---"
  ls -lh "$OUT"
} > "$OUT/MANIFEST.txt"

echo ""
echo "✅ Backup completo listo: $OUT"
echo "   Tamaño total: $(du -sh "$OUT" | cut -f1)"
echo ""
echo "Siguiente paso recomendado:"
echo "  # Subir off-site (rclone B2)"
echo "  rclone copy $OUT b2:tu-bucket/divinittys-migration/$STAMP --progress"
echo "  # o rsync al VPS nuevo"
echo "  rsync -ahz --progress $OUT/ root@NUEVA_IP:/root/migration/$STAMP/"
echo ""
echo "Luego en el VPS nuevo: bash scripts/restore-stack-v2.sh /ruta/al/backup/$STAMP"
