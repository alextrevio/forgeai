#!/bin/bash
set -euo pipefail

# ── ForgeAI Deploy Script ────────────────────────────────
# Run as user 'forgeai' on the server
#
# Usage: ./scripts/deploy.sh <SERVER_IP>
# Example: ./scripts/deploy.sh 164.90.123.45

if [ $# -lt 1 ]; then
  echo "Usage: $0 <SERVER_IP>"
  echo "Example: $0 164.90.123.45"
  exit 1
fi

SERVER_IP="$1"
APP_DIR="/opt/forgeai"
COMPOSE_FILE="docker-compose.prod.yml"

echo "════════════════════════════════════════════════════════"
echo "  ForgeAI — Deploy"
echo "  Server: $SERVER_IP"
echo "════════════════════════════════════════════════════════"

cd "$APP_DIR"

# ── 1. Clone or pull ─────────────────────────────────────
if [ ! -f "$COMPOSE_FILE" ]; then
  if [ -z "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
    echo ""
    echo "→ Repository not found. Clone it first:"
    echo "  git clone <your-repo-url> $APP_DIR"
    exit 1
  fi
fi

echo ""
echo "→ Repository found at $APP_DIR"

# ── 2. Generate .env if it doesn't exist ─────────────────
if [ ! -f .env ]; then
  echo "→ Generating .env with secure secrets..."

  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  ENCRYPTION_KEY=$(openssl rand -hex 16)
  DB_PASSWORD=$(openssl rand -hex 16)

  cat > .env << EOF
# ── ForgeAI Production Environment ──────────────────────
# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Server: $SERVER_IP

# ── Database ────────────────────────────────────────────
DATABASE_URL="postgresql://forgeai:${DB_PASSWORD}@postgres:5432/forgeai?schema=public"
DB_PASSWORD="${DB_PASSWORD}"

# ── Authentication ──────────────────────────────────────
JWT_SECRET="${JWT_SECRET}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"

# ── Encryption ──────────────────────────────────────────
ENCRYPTION_KEY="${ENCRYPTION_KEY}"

# ── URLs ────────────────────────────────────────────────
APP_URL="http://${SERVER_IP}"
API_URL="http://${SERVER_IP}"
ALLOWED_ORIGINS="http://${SERVER_IP}"

# ── Next.js build args ──────────────────────────────────
NEXT_PUBLIC_API_URL="http://${SERVER_IP}"
NEXT_PUBLIC_APP_URL="http://${SERVER_IP}"
NEXT_PUBLIC_WS_URL="ws://${SERVER_IP}"

# ── Server ──────────────────────────────────────────────
NODE_ENV=production
PORT=8000
LOG_LEVEL=info

# ── Sandbox ─────────────────────────────────────────────
SANDBOXES_DIR=/app/.sandboxes
SANDBOX_TTL_MINUTES=30

# ── AI Provider (leave empty for demo mode) ─────────────
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
EOF

  echo "  .env created with auto-generated secrets"
  echo "  DB_PASSWORD: ${DB_PASSWORD:0:8}..."
else
  echo "→ .env already exists, keeping current values"
fi

# ── 3. Build Docker images ───────────────────────────────
echo ""
echo "→ Building Docker images (this may take a few minutes)..."
docker compose -f "$COMPOSE_FILE" build --parallel 2>&1 | tail -5

# ── 4. Start services ────────────────────────────────────
echo ""
echo "→ Starting services..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# ── 5. Wait for PostgreSQL ───────────────────────────────
echo "→ Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U forgeai > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    echo "  ERROR: PostgreSQL did not become ready in time"
    docker compose -f "$COMPOSE_FILE" logs postgres --tail=20
    exit 1
  fi
  sleep 2
done
echo "  PostgreSQL is ready"

# ── 6. Run database migrations ───────────────────────────
echo "→ Running database migrations..."
docker compose -f "$COMPOSE_FILE" exec -T api npx prisma db push --accept-data-loss 2>&1 | tail -3
echo "  Database schema applied"

# ── 7. Health check ──────────────────────────────────────
echo ""
echo "→ Running health check..."
sleep 3

HEALTH_RETRIES=10
HEALTH_OK=false
for i in $(seq 1 $HEALTH_RETRIES); do
  if RESPONSE=$(curl -sf http://localhost/api/health 2>/dev/null); then
    echo "  $RESPONSE"
    HEALTH_OK=true
    break
  fi
  echo "  Attempt $i/$HEALTH_RETRIES — waiting..."
  sleep 3
done

if [ "$HEALTH_OK" = false ]; then
  echo "  WARNING: Health check did not pass. Check logs with:"
  echo "  ./scripts/logs.sh api"

  # Try direct API port as fallback check
  if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "  Note: API responds on :8000 directly. Nginx may need a moment."
  fi
fi

# ── 8. Show running services ─────────────────────────────
echo ""
echo "→ Running services:"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
  docker compose -f "$COMPOSE_FILE" ps

# ── Summary ──────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  ForgeAI deployed successfully!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  App:     http://$SERVER_IP"
echo "  API:     http://$SERVER_IP/api/health"
echo ""
echo "  To add your Anthropic API key:"
echo "    nano $APP_DIR/.env"
echo "    # Set ANTHROPIC_API_KEY=sk-ant-xxxxx"
echo "    docker compose -f $COMPOSE_FILE restart api"
echo ""
echo "  Useful commands:"
echo "    ./scripts/logs.sh          — view all logs"
echo "    ./scripts/logs.sh api      — view API logs only"
echo "    ./scripts/backup.sh        — backup database"
echo "    ./scripts/add-domain.sh    — add SSL domain"
echo ""
