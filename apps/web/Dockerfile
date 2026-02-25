# ── Stage 1: Builder ──────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

WORKDIR /app

# Copy workspace config + all package.jsons for install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/

# Install all deps (cached layer if lockfile unchanged)
RUN pnpm install --frozen-lockfile

# Copy full source for needed packages
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY apps/web/ apps/web/

# Generate Prisma client (needed if web imports from @forgeai/db types)
RUN cd packages/db && npx prisma generate

# NEXT_PUBLIC_* vars must be available at build time
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

# Build web and its workspace dependencies
RUN pnpm turbo build --filter=@forgeai/web...

# ── Stage 2: Runner ──────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat curl wget
RUN addgroup --system --gid 1001 forgeai && \
    adduser --system --uid 1001 forgeai

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy Next.js standalone output (includes node_modules)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN chown -R forgeai:forgeai /app

USER forgeai

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --spider -q http://localhost:3000 || exit 1

CMD ["node", "apps/web/server.js"]
