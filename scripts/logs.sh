#!/bin/bash
set -euo pipefail

# ── ForgeAI Logs Viewer ──────────────────────────────────
# Run as user 'forgeai'
#
# Usage:
#   ./scripts/logs.sh            — all services
#   ./scripts/logs.sh api        — API only
#   ./scripts/logs.sh web        — Web only
#   ./scripts/logs.sh postgres   — Database only
#   ./scripts/logs.sh nginx      — Nginx only

APP_DIR="/opt/forgeai"
COMPOSE_FILE="docker-compose.prod.yml"

if [ $# -gt 0 ]; then
  echo "→ Showing logs for: $1"
  docker compose -f "$APP_DIR/$COMPOSE_FILE" logs -f --tail=100 "$1"
else
  echo "→ Showing logs for all services (Ctrl+C to exit)"
  docker compose -f "$APP_DIR/$COMPOSE_FILE" logs -f --tail=100
fi
