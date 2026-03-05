#!/bin/bash
# PostgreSQL backup script for Arya AI
# Usage: ./scripts/backup-db.sh
# Cron: 0 3 * * * /opt/forgeai/scripts/backup-db.sh

BACKUP_DIR="/opt/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/arya-${TIMESTAMP}.sql.gz"
RETAIN_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting PostgreSQL backup..."

docker exec forgeai-postgres-1 pg_dump -U forgeai forgeai | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup completed: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date)] ERROR: Backup failed!"
  exit 1
fi

# Clean old backups
find "$BACKUP_DIR" -name "arya-*.sql.gz" -mtime +$RETAIN_DAYS -delete
echo "[$(date)] Cleaned backups older than ${RETAIN_DAYS} days"
