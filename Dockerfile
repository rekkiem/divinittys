# ============================================================
# DIVINITTYS - Dockerfile multi-stage
# Stages: base -> deps -> development -> migrator -> builder -> production
# ============================================================

# ── Base ─────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

# ── Deps: install only what's needed ─────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --include=dev

# ── Development (local Docker Compose) ───────────────────────
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN mkdir -p .next/cache
EXPOSE 3000
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "run", "dev"]

# ── Migrator (production one-off Prisma migrations + seed) ───
FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

# ── Builder (production build) ────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client for production
RUN npx prisma generate
# Build Next.js — requires env stubs (real values injected at runtime)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Stub required env vars so build doesn't throw
ENV DATABASE_URL="postgresql://stub:stub@localhost/stub"
ENV JWT_SECRET="build-time-stub-not-used-at-runtime"
ENV JWT_REFRESH_SECRET="build-time-stub-not-used-at-runtime"
ENV NEXT_PUBLIC_APP_URL="https://divinittys.cl"
RUN npm run build

# ── Production runtime ────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Only production deps
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs && \
    mkdir -p /app/log && \
    chown -R nextjs:nodejs /app/log

# Copy Next.js standalone output (requires output: 'standalone' in next.config.js)
COPY --from=builder /app/public           ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
# Copy Prisma for runtime migrations
COPY --from=builder /app/prisma           ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

# Healthcheck so Fly.io knows when the app is ready
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
