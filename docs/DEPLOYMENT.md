# ForgeAI Production Deployment Guide

## Server Requirements

| Resource | Minimum   | Recommended |
| -------- | --------- | ----------- |
| CPU      | 2 cores   | 4 cores     |
| RAM      | 4 GB      | 8 GB        |
| Disk     | 40 GB SSD | 100 GB SSD  |
| OS       | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

Software:
- Docker 24+ and Docker Compose v2
- Git
- (Optional) Certbot for SSL

## Step-by-Step Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin (if not included)
sudo apt install docker-compose-plugin -y

# Relogin for group changes
exit
```

### 2. Clone and Configure

```bash
git clone <repo-url> ~/forgeai
cd ~/forgeai

cp .env.example .env
```

Edit `.env` with production values:

```bash
# REQUIRED — Generate secure secrets
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# Update DATABASE_URL to match docker-compose postgres service
DATABASE_URL="postgresql://forgeai:your-strong-password@postgres:5432/forgeai?schema=public"

# Set your domain
APP_URL="https://yourdomain.com"
API_URL="https://yourdomain.com"
ALLOWED_ORIGINS="https://yourdomain.com"

# Frontend build args
NEXT_PUBLIC_API_URL="https://yourdomain.com"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NEXT_PUBLIC_WS_URL="wss://yourdomain.com"

NODE_ENV=production
LOG_LEVEL=info
```

### 3. Update Nginx for Your Domain

Edit `nginx/nginx.conf`:

```nginx
server_name yourdomain.com;
```

### 4. Build and Start

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# Run database migrations
docker compose -f docker-compose.prod.yml exec api npx prisma db push

# Verify health
curl http://localhost/api/health
```

### 5. SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot -y

# Get certificate (stop nginx first)
docker compose -f docker-compose.prod.yml stop nginx
sudo certbot certonly --standalone -d yourdomain.com
docker compose -f docker-compose.prod.yml start nginx
```

Then update `nginx/nginx.conf` to enable the SSL server block (uncomment the HTTPS section) and update the certificate paths:

```nginx
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

Add a cron job for auto-renewal:
```bash
echo "0 3 * * * certbot renew --pre-hook 'docker compose -f ~/forgeai/docker-compose.prod.yml stop nginx' --post-hook 'docker compose -f ~/forgeai/docker-compose.prod.yml start nginx'" | sudo crontab -
```

## Updating

```bash
cd ~/forgeai
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.prod.yml exec api npx prisma db push
docker image prune -f
```

## Backup

### Database

```bash
# Create backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U forgeai forgeai > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
cat backup_file.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U forgeai forgeai
```

### Automated Backups

```bash
# Daily backup cron (keeps 7 days)
echo "0 2 * * * cd ~/forgeai && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U forgeai forgeai | gzip > ~/backups/forgeai_\$(date +\%Y\%m\%d).sql.gz && find ~/backups -name '*.sql.gz' -mtime +7 -delete" | crontab -
```

## Monitoring

### Health Check

```bash
curl http://localhost:8000/api/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600,
  "services": {
    "database": "ok"
  }
}
```

### Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

### Metrics

```bash
# Requires authentication
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/metrics
```

## Troubleshooting

| Issue | Solution |
| ----- | -------- |
| Database connection refused | Check `DATABASE_URL` matches docker-compose postgres service. Run `docker compose ps` to verify postgres is running. |
| Port 80/443 in use | Stop existing web server: `sudo systemctl stop nginx apache2` |
| Build fails OOM | Increase Docker memory limit or add swap: `sudo fallocate -l 4G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Container keeps restarting | Check logs: `docker compose logs <service>` |
| SSL cert not renewing | Check certbot cron: `sudo crontab -l` |
