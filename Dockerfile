# ============================================================
# DIVINITTYS — Dockerfile multi-stage
# Stages: base → deps → builder → production (default)
# ============================================================

# ── Base ─────────────────────────────────────────────────────
FROM node:22-alpine AS base
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
RUN npm run build

# ── Production (Fly.io target) ────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Only production deps
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

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
