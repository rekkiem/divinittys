# ============================================================
# DIVINITTYS - Dockerfile multi-stage

# Stages: base -> deps -> development -> migrator -> tools -> builder -> production
# ============================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app


# ── Deps: install only what's needed ─────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --include=dev

# ── Development (local Docker Compose) ───────────────────────
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


# ── Migrator (production one-off Prisma migrations + seed) ───
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


# Healthcheck so Fly.io knows when the app is ready
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
