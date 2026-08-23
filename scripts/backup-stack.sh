#!/usr/bin/env bash
# ============================================================
# Backup portable del stack (Postgres + volúmenes críticos)
# Uso:
#   bash scripts/backup-stack.sh
#   BACKUP_DIR=/var/backups/divinittys bash scripts/backup-stack.sh
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/$STAMP"

cd "$APP_DIR"
mkdir -p "$OUT"

# shellcheck disable=SC1090
set -a
# export solo claves no sensibles para nombres; passwords vía compose env
source <(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$ENV_FILE" | sed 's/\r$//') || true
set +a
POSTGRES_USER="${POSTGRES_USER:-divinittys}"
POSTGRES_DB="${POSTGRES_DB:-divinittys}"

echo "📦 Backup → $OUT"

# Postgres dump
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT/postgres.sql.gz"
echo "  ✓ postgres.sql.gz"

# Copia .env (permisos restrictivos)
cp "$ENV_FILE" "$OUT/env.production.backup"
chmod 600 "$OUT/env.production.backup"
echo "  ✓ env.production.backup"

# Lista de volúmenes Docker del proyecto
docker volume ls --format '{{.Name}}' | grep -i divinittys > "$OUT/volumes.txt" || true
echo "  ✓ volumes.txt"

# Opcional: tar de datos MinIO vía volumen (puede ser grande)
if docker volume ls -q | grep -q 'minio_data'; then
  VOL=$(docker volume ls -q | grep 'minio_data' | head -1)
  docker run --rm -v "$VOL":/data -v "$OUT":/backup alpine \
    tar czf /backup/minio_data.tar.gz -C /data . 2>/dev/null \
    && echo "  ✓ minio_data.tar.gz" || echo "  ⚠ minio tar omitido"
fi

# Manifest
{
  echo "stamp=$STAMP"
  echo "host=$(hostname)"
  echo "app_dir=$APP_DIR"
  date -u +"utc=%Y-%m-%dT%H:%M:%SZ"
  git rev-parse HEAD 2>/dev/null | sed 's/^/git=/' || true
} > "$OUT/MANIFEST.txt"

echo "✅ Backup listo: $OUT"
echo "   Copia este directorio al VPS nuevo antes de restore-stack.sh"
