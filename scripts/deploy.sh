#!/usr/bin/env bash
# ============================================================
# DIVINITTYS — Production deploy (Docker Compose / VPS)
#
# Usage:
#   bash scripts/deploy.sh
#   bash scripts/deploy.sh --skip-pull
#   bash scripts/deploy.sh --first-time   # ONLY for a genuinely empty DB
#
# Optional:
#   APP_DIR=/opt/divinittys
#   ENV_FILE=.env.production
#   COMPOSE_FILE=docker-compose.prod.yml
#   PUBLIC_URL=https://divinittys.cl
# ============================================================
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
PUBLIC_URL="${PUBLIC_URL:-https://divinittys.cl}"
SKIP_PULL=0
FIRST_TIME=0

for arg in "$@"; do
  case "$arg" in
    --skip-pull) SKIP_PULL=1 ;;
    --first-time) FIRST_TIME=1 ;;
    --help|-h) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

cd "$APP_DIR"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: falta $ENV_FILE" >&2; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { echo "ERROR: falta $COMPOSE_FILE" >&2; exit 1; }
chmod 600 "$ENV_FILE"

COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")
TOOLS_COMPOSE=( "${COMPOSE[@]}" --profile tools )

log() { printf '\n[OK] %s\n' "$*"; }
die() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

# Never proceed with obvious placeholder secrets.
if grep -Eq '__CHANGE_ME__|__CH_|your_.*_here|CHANGE_ME' "$ENV_FILE"; then
  die "$ENV_FILE contiene posibles placeholders. Revísalo sin compartir sus valores."
fi

# Validate Compose interpolation before changing production.
"${COMPOSE[@]}" config --quiet || die "docker compose config falló"

if [[ "$SKIP_PULL" -eq 0 ]] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH="$(git branch --show-current)"
  [[ -n "$BRANCH" ]] || die "No hay rama activa."
  git fetch origin
  git pull --ff-only origin "$BRANCH" || die "No se pudo actualizar la rama $BRANCH."
  log "Código actualizado desde origin/$BRANCH"
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 && {
  echo "Commit: $(git rev-parse --short HEAD)"
  echo "Rama:   $(git branch --show-current)"
}

# Build both runtime and operational tooling images. The importer profile
# is explicitly enabled; it is not part of the default Compose service list.
"${TOOLS_COMPOSE[@]}" build app workers importer
log "Imágenes app / workers / importer construidas"

# Start data services and wait for their health checks.
"${COMPOSE[@]}" up -d postgres redis meilisearch minio
for service in postgres redis meilisearch minio; do
  healthy=0
  for attempt in $(seq 1 60); do
    state="$("${COMPOSE[@]}" ps --format json "$service" 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
    if [[ "$state" == "healthy" ]]; then healthy=1; break; fi
    sleep 2
  done
  [[ "$healthy" -eq 1 ]] || die "El servicio $service no llegó a healthy. Revisa docker compose logs $service"
done
log "PostgreSQL, Redis, Meilisearch y MinIO saludables"

# Migrations are mandatory. Do not use the standalone app image for Prisma CLI.
# Pin the Prisma CLI to the project's 6.2.1 version.
"${TOOLS_COMPOSE[@]}" run --rm --no-deps importer \
  sh -lc 'npx --yes prisma@6.2.1 migrate deploy' \
  || die "Falló prisma migrate deploy. La aplicación NO será actualizada."

"${TOOLS_COMPOSE[@]}" run --rm --no-deps importer \
  sh -lc 'npx --yes prisma@6.2.1 migrate status' \
  || die "No se pudo verificar el estado final de las migraciones."
log "Migraciones aplicadas y verificadas"

# Seed is deliberately opt-in and only suitable for a genuinely new database.
if [[ "$FIRST_TIME" -eq 1 ]]; then
  echo "ATENCIÓN: --first-time ejecutará seed y tareas iniciales."
  "${TOOLS_COMPOSE[@]}" run --rm --no-deps importer sh -lc 'npx tsx prisma/seed.ts' \
    || die "Falló el seed inicial."
  "${TOOLS_COMPOSE[@]}" run --rm --no-deps importer sh -lc 'npx tsx scripts/setupMinio.ts' \
    || die "Falló setupMinio."
  "${TOOLS_COMPOSE[@]}" run --rm --no-deps importer sh -lc 'npx tsx scripts/reindex-search.ts' \
    || die "Falló reindex-search."
fi

# Start/update app and workers only after migrations succeeded.
"${COMPOSE[@]}" up -d app workers
app_healthy=0
for attempt in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T app curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
    app_healthy=1
    break
  fi
  sleep 2
done
[[ "$app_healthy" -eq 1 ]] || {
  "${COMPOSE[@]}" logs --tail=100 app >&2 || true
  die "La app no superó el health check interno."
}
log "Next.js responde correctamente en el puerto interno 3000"

# Publish Nginx only after the upstream app is healthy.
"${COMPOSE[@]}" up -d nginx
"${COMPOSE[@]}" up -d certbot || echo "WARN: certbot no pudo iniciarse; revisar si es necesario."

public_healthy=0
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 10 "$PUBLIC_URL/api/health" >/dev/null 2>&1; then
    public_healthy=1
    break
  fi
  sleep 2
done
[[ "$public_healthy" -eq 1 ]] || {
  "${COMPOSE[@]}" logs --tail=100 nginx app >&2 || true
  die "La URL pública no superó health check: $PUBLIC_URL/api/health"
}

"${COMPOSE[@]}" ps
log "DEPLOY COMPLETADO — $PUBLIC_URL"
