# syntax=docker/dockerfile:1.7
# Multi-stage build untuk Hillside Eden (Next.js + worker)
# Lihat docs/03-architecture.md #1 dan docs/08-quality-security-ops.md #6-7.

# --- Stage 1: deps (install full deps termasuk dev untuk build) ---
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# libc6-compat untuk sharp & binding native
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
RUN corepack enable && corepack prepare pnpm@12.4.2 --activate
RUN pnpm install --frozen-lockfile

# --- Stage 2: builder (compile Next.js) ---
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 \
    && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && corepack prepare pnpm@12.4.2 --activate
RUN pnpm run build

# --- Stage 3: runner (production image) ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Makassar \
    PORT=3000
# Non-root user untuk keamanan
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
# Salin artefak build & node_modules produksi
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
# Standalone output bisa diaktifkan di next.config.ts (opsional)
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["pnpm", "start"]