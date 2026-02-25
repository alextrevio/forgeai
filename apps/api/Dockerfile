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

# Use pnpm deploy to create a standalone directory with real deps
RUN pnpm --filter=@forgeai/api deploy --prod /app/deployed

# ── Stage 2: Runner ──────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl curl wget zip unzip git
RUN addgroup --system --gid 1001 forgeai && \
    adduser --system --uid 1001 forgeai

WORKDIR /app

# Copy the deployed standalone app (real deps, no symlinks)
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

# Copy Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema
COPY --from=builder /app/packages/db/prisma ./prisma

RUN mkdir -p deploys .sandboxes tmp && chown -R forgeai:forgeai /app

ENV NODE_ENV=production
ENV PORT=8000

USER forgeai
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --spider -q http://localhost:8000/api/health || exit 1

CMD ["node", "dist/index.js"]
