#!/bin/bash
# ============================================================
# DIVINITTYS — Genera secrets seguros para producción Vultr
# Uso: bash scripts/generate-secrets.sh
# ============================================================
echo ""
echo "══════════════════════════════════════════════════════"
echo "  DIVINITTYS — Secrets para producción"
echo "══════════════════════════════════════════════════════"
echo ""

PG_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
RD_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
MEILI_KEY=$(openssl rand -hex 32)
MINIO_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT=$(openssl rand -hex 64)
JWT_R=$(openssl rand -hex 64)

echo "# ── Copia estos valores en .env.production ──"
echo ""
echo "POSTGRES_PASSWORD=$PG_PASS"
echo "DATABASE_URL=postgresql://divinittys:${PG_PASS}@postgres:5432/divinittys?schema=public"
echo ""
echo "REDIS_PASSWORD=$RD_PASS"
echo "REDIS_URL=redis://:${RD_PASS}@redis:6379"
echo ""
echo "MEILI_MASTER_KEY=$MEILI_KEY"
echo "MEILISEARCH_API_KEY=$MEILI_KEY"
echo ""
echo "MINIO_SECRET_KEY=$MINIO_SECRET"
echo ""
echo "JWT_SECRET=$JWT"
echo "JWT_REFRESH_SECRET=$JWT_R"
echo ""
echo "══════════════════════════════════════════════════════"
echo "  ⚠️  GUARDA ESTOS VALORES — no se regeneran igual"
echo "══════════════════════════════════════════════════════"
