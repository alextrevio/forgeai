# ── Stage 1: Builder ──────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl python3 make g++
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/sandbox-manager/package.json packages/sandbox-manager/
COPY packages/agents/package.json packages/agents/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/api/ apps/api/

RUN cd packages/db && npx prisma generate
RUN pnpm turbo build --filter=@forgeai/api...

# Create standalone deployed directory with real deps
RUN pnpm --filter=@forgeai/api deploy --legacy --prod /app/deployed

# Copy Prisma generated client into deployed node_modules
RUN cp -rL $(find /app/node_modules/.pnpm -path "*/@prisma/client" -type d | head -1)/../../.prisma /app/deployed/node_modules/.prisma 2>/dev/null || true
RUN cp -rL $(find /app/node_modules/.pnpm -path "*/@prisma/client" -type d | head -1)/../../@prisma /app/deployed/node_modules/@prisma 2>/dev/null || true

# ── Stage 2: Runner ──────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl curl wget zip unzip git
RUN addgroup --system --gid 1001 forgeai && \
    adduser --system --uid 1001 forgeai

WORKDIR /app

# Copy deployed node_modules (real deps + prisma)
COPY --from=builder /app/deployed/node_modules ./node_modules

# Copy built API dist
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./

# Copy built workspace package dist directories
COPY --from=builder /app/packages/shared/dist ./node_modules/@forgeai/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@forgeai/shared/
COPY --from=builder /app/packages/db/dist ./node_modules/@forgeai/db/dist
COPY --from=builder /app/packages/db/package.json ./node_modules/@forgeai/db/
COPY --from=builder /app/packages/agents/dist ./node_modules/@forgeai/agents/dist
COPY --from=builder /app/packages/agents/package.json ./node_modules/@forgeai/agents/
COPY --from=builder /app/packages/sandbox-manager/dist ./node_modules/@forgeai/sandbox-manager/dist
COPY --from=builder /app/packages/sandbox-manager/package.json ./node_modules/@forgeai/sandbox-manager/

# Copy Prisma schema
COPY --from=builder /app/packages/db/prisma ./prisma

# Create required directories
RUN mkdir -p deploys .sandboxes tmp && chown -R forgeai:forgeai /app

ENV NODE_ENV=production
ENV PORT=8000

USER forgeai
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --spider -q http://localhost:8000/api/health || exit 1

CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
