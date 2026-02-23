#!/bin/bash
set -euo pipefail

# ── ForgeAI Database Backup ──────────────────────────────
# Run as user 'forgeai'
#
# Usage: ./scripts/backup.sh

APP_DIR="/opt/forgeai"
BACKUP_DIR="$APP_DIR/backups"
COMPOSE_FILE="docker-compose.prod.yml"
KEEP_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/forgeai_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "→ Backing up ForgeAI database..."

# Dump and compress
docker compose -f "$APP_DIR/$COMPOSE_FILE" exec -T postgres \
  pg_dump -U forgeai forgeai | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "  Created: $BACKUP_FILE ($BACKUP_SIZE)"

# Remove old backups (keep last 7 days)
DELETED=$(find "$BACKUP_DIR" -name "forgeai_*.sql.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "  Cleaned: $DELETED old backup(s)"
fi

# Show remaining backups
TOTAL=$(find "$BACKUP_DIR" -name "forgeai_*.sql.gz" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "  Total: $TOTAL backup(s), $TOTAL_SIZE"
