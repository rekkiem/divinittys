# ============================================================
# DIVINITTYS - Dockerfile optimizado (cache-efficient)
# ============================================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

# ── Deps: solo package.json + prisma schema ──────────────
# FIX: Copiar prisma schema ANTES de npm install
# Esto evita que el postinstall hook de prisma falle
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
# Instalar todas las deps (incluyendo dev para build)
RUN npm ci --include=dev || npm install --include=dev

# ── Development ──────────────────────────────────────────
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generar cliente Prisma dentro de la imagen
RUN npx prisma generate
# Pre-crear .next/cache para evitar ENOENT en bind mount
RUN mkdir -p .next/cache
EXPOSE 3000
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "run", "dev"]

# ── Builder: Next.js production build ────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ── Production runtime (imagen mínima) ───────────────────
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
