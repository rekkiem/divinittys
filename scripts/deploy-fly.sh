#!/bin/bash
# =============================================================
# DIVINITTYS — Deploy to Fly.io
# Run this ONCE to set up, then use: fly deploy
# =============================================================
set -e

APP_NAME="${1:-divinittys}"

echo "🚀 Deploying DIVINITTYS to Fly.io as: $APP_NAME"
echo ""

# ── Step 1: Create the app (only first time) ─────────────────
echo "1️⃣  Creating Fly.io app..."
fly apps create "$APP_NAME" --org personal 2>/dev/null || echo "   App already exists, continuing..."

# Update fly.toml with real app name
sed -i "s/^app = .*/app = \"$APP_NAME\"/" fly.toml
echo "   fly.toml updated with app name: $APP_NAME"

# ── Step 2: Provision PostgreSQL ─────────────────────────────
echo ""
echo "2️⃣  Creating PostgreSQL database..."
fly postgres create \
  --name "${APP_NAME}-db" \
  --region scl \
  --vm-size shared-cpu-1x \
  --volume-size 1 \
  --initial-cluster-size 1 2>/dev/null || echo "   DB already exists"

fly postgres attach "${APP_NAME}-db" --app "$APP_NAME" 2>/dev/null || echo "   DB already attached"

# ── Step 3: Set secrets (edit these before running) ──────────
echo ""
echo "3️⃣  Setting secrets..."
fly secrets set \
  --app "$APP_NAME" \
  JWT_SECRET="$(openssl rand -hex 64)" \
  JWT_REFRESH_SECRET="$(openssl rand -hex 64)" \
  NEXT_PUBLIC_APP_URL="https://${APP_NAME}.fly.dev" \
  MINIO_USE_SSL="true" \
  NODE_ENV="production"

echo ""
echo "⚠️  Set these secrets manually with your real values:"
echo "   fly secrets set --app $APP_NAME MEILISEARCH_URL=https://..."
echo "   fly secrets set --app $APP_NAME MEILISEARCH_API_KEY=..."
echo "   fly secrets set --app $APP_NAME MINIO_ENDPOINT=..."
echo "   fly secrets set --app $APP_NAME MINIO_ACCESS_KEY=..."
echo "   fly secrets set --app $APP_NAME MINIO_SECRET_KEY=..."
echo "   fly secrets set --app $APP_NAME MINIO_BUCKET=imagenes"
echo "   fly secrets set --app $APP_NAME MINIO_PUBLIC_URL=https://..."
echo "   fly secrets set --app $APP_NAME REDIS_URL=redis://..."

# ── Step 4: Deploy ────────────────────────────────────────────
echo ""
echo "4️⃣  Deploying..."
fly deploy --app "$APP_NAME" --strategy rolling

# ── Step 5: Run migrations ────────────────────────────────────
echo ""
echo "5️⃣  Running migrations + seed..."
fly ssh console --app "$APP_NAME" -C "npx prisma migrate deploy && npx tsx prisma/seed.ts"

echo ""
echo "✅ Deploy complete!"
echo "   URL: https://${APP_NAME}.fly.dev"
echo "   Logs: fly logs --app $APP_NAME"
echo "   SSH:  fly ssh console --app $APP_NAME"
