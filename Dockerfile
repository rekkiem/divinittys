# ============================================================
# DIVINITTYS - Dockerfile multi-stage
# Stages: base -> deps -> development -> migrator -> tools -> builder -> production
# ============================================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
# --legacy-peer-deps: next-auth@5 pide nodemailer ^7|^8 (optional); el proyecto usa 6.9.x
# y hay otros peers (p.ej. bull-board/hono). npm ci estricto rompe el build.
RUN npm install --include=dev --legacy-peer-deps
RUN npx prisma generate

FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN mkdir -p .next/cache
EXPOSE 3000
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "run", "dev"]

FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

# Operational tooling image for one-off imports and maintenance scripts.
# Keeps devDependencies (including tsx) and repository scripts isolated from
# the lean production runtime image.
FROM base AS tools
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN mkdir -p /app/imports
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["sh"]

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time placeholders only. Next.js imports server modules while collecting
# route/page data; env.ts validates required variables at module load time.
# These values are deliberately non-secret and are NOT copied to the runtime
# image. Production credentials are injected only by Compose at container start.
ENV DATABASE_URL="postgresql://stub:stub@localhost/stub"
ENV JWT_SECRET="build-time-stub-not-used-at-runtime"
ENV JWT_REFRESH_SECRET="build-time-stub-not-used-at-runtime"
ENV REDIS_URL="redis://localhost:6379"
ENV NEXT_PUBLIC_APP_URL="https://divinittys.cl"
ENV MINIO_ENDPOINT="localhost"
ENV MINIO_PORT="9000"
ENV MINIO_USE_SSL="false"
ENV MINIO_ACCESS_KEY="build-time-stub"
ENV MINIO_SECRET_KEY="build-time-stub"
ENV MINIO_BUCKET="imagenes"
ENV MEILISEARCH_URL="http://localhost:7700"
ENV MEILISEARCH_API_KEY="build-time-stub"

# Stubs para build: Auth.js lee estas al importar auth.ts
ENV AUTH_SECRET="build-time-stub-not-used-at-runtime"
ENV AUTH_GOOGLE_ID="build-time-stub"
ENV AUTH_GOOGLE_SECRET="build-time-stub"
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/log && \
    chown -R nextjs:nodejs /app/log

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
