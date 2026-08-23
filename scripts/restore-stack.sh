#!/usr/bin/env bash
# ============================================================
# Restore tras migrar de proveedor
# Uso:
#   bash scripts/restore-stack.sh /ruta/al/backup/YYYYMMDD-HHMMSS
# ============================================================
set -euo pipefail

BACKUP_PATH="${1:-}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

[[ -n "$BACKUP_PATH" && -d "$BACKUP_PATH" ]] || {
  echo "Uso: bash scripts/restore-stack.sh /ruta/backup/STAMP"
  exit 1
}

cd "$APP_DIR"
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

echo "♻️  Restore desde $BACKUP_PATH"

# Restaurar env si no existe
if [[ ! -f "$ENV_FILE" && -f "$BACKUP_PATH/env.production.backup" ]]; then
  cp "$BACKUP_PATH/env.production.backup" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "  ✓ $ENV_FILE restaurado"
fi

"${COMPOSE[@]}" up -d postgres
sleep 10

set -a
source <(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$ENV_FILE" | sed 's/\r$//') || true
set +a
POSTGRES_USER="${POSTGRES_USER:-divinittys}"
POSTGRES_DB="${POSTGRES_DB:-divinittys}"

if [[ -f "$BACKUP_PATH/postgres.sql.gz" ]]; then
  gunzip -c "$BACKUP_PATH/postgres.sql.gz" | \
    "${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
  echo "  ✓ postgres restaurado"
fi

if [[ -f "$BACKUP_PATH/minio_data.tar.gz" ]]; then
  VOL=$(docker volume ls -q | grep 'minio_data' | head -1 || true)
  if [[ -n "$VOL" ]]; then
    docker run --rm -v "$VOL":/data -v "$BACKUP_PATH":/backup alpine \
      sh -c 'cd /data && tar xzf /backup/minio_data.tar.gz'
    echo "  ✓ minio data restaurado"
  fi
fi

echo "Siguiente: bash scripts/deploy.sh --skip-pull"
echo "Luego reindex: docker compose --profile tools run --rm importer npx tsx scripts/reindex-search.ts"
