#!/usr/bin/env bash
# Compatibilidad: wrapper hacia deploy portable.
# Preferir: bash scripts/deploy.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export APP_DIR="${APP_DIR:-/opt/divinittys}"
export PUBLIC_URL="${PUBLIC_URL:-https://divinittys.cl}"
exec bash "$DIR/deploy.sh" "$@"
