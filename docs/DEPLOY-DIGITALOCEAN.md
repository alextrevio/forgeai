# ForgeAI — DigitalOcean Deployment Guide

Deploy ForgeAI on a DigitalOcean Droplet with a single command. Works with just an IP address (no domain required).

## Prerequisites

- DigitalOcean account ([sign up](https://www.digitalocean.com))
- SSH key added to your DigitalOcean account
- Git repository with ForgeAI code

## Paso 1: Crear el Droplet

1. Go to **DigitalOcean → Create → Droplets**
2. Choose:
   - **OS**: Ubuntu 24.04 LTS
   - **Plan**: Regular (Shared CPU) — **$24/mo (4 GB / 2 CPU)**
   - **Datacenter**: closest to your users
   - **Authentication**: SSH key (recommended)
3. Click **Create Droplet**
4. Copy the IP address (e.g., `164.90.123.45`)

## Paso 2: Setup del Servidor

SSH into your droplet as root and run the setup script:

```bash
ssh root@TU_IP

# Option A: Clone first, then run setup
git clone https://github.com/TU_USER/forgeai.git /opt/forgeai
bash /opt/forgeai/scripts/server-setup.sh

# Option B: Run setup script directly (if repo is public)
curl -sSL https://raw.githubusercontent.com/TU_USER/forgeai/main/scripts/server-setup.sh | bash
```

The script will:
- Update system packages
- Install Docker (official repo) + Docker Compose
- Configure firewall (SSH, HTTP, HTTPS only)
- Enable fail2ban (SSH brute-force protection)
- Create `forgeai` user with Docker access
- Set up 4 GB swap (prevents OOM during builds)

## Paso 3: Deploy

Switch to the `forgeai` user and run the deploy script:

```bash
su - forgeai
cd /opt/forgeai

# If repo wasn't cloned yet:
git clone https://github.com/TU_USER/forgeai.git .

# Make scripts executable
chmod +x scripts/*.sh

# Deploy! (pass your droplet IP)
./scripts/deploy.sh TU_IP
```

The deploy script will:
- Auto-generate all secrets (JWT, encryption key, DB password)
- Build Docker images for API and Web
- Start PostgreSQL, Redis, API, Web, and Nginx
- Run database migrations
- Verify health check

## Paso 4: Verificar

1. Open `http://TU_IP` in your browser
2. You should see the ForgeAI login page
3. Register a new account
4. Create a test project

Check API health:
```bash
curl http://TU_IP/api/health
# {"status":"healthy","timestamp":"...","version":"0.1.0","uptime":42,"services":{"database":"ok"}}
```

## Paso 5: Agregar API Key de Anthropic

The app works in demo mode without an API key, but to enable the AI agents:

```bash
nano /opt/forgeai/.env
# Find and set: ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Restart the API to pick up the change
docker compose -f /opt/forgeai/docker-compose.prod.yml restart api
```

## Paso 6: Agregar Dominio (cuando lo tengas)

Once you have a domain pointed to your droplet's IP:

```bash
# Make sure DNS A record points to your droplet IP first!
sudo /opt/forgeai/scripts/add-domain.sh tudominio.com
```

This will:
- Update nginx with your domain name
- Obtain Let's Encrypt SSL certificate
- Configure HTTPS with auto-renewal
- Rebuild the web app with HTTPS URLs
- Restart all services

## Comandos Útiles

```bash
# View logs (all services)
./scripts/logs.sh

# View logs (specific service)
./scripts/logs.sh api
./scripts/logs.sh web
./scripts/logs.sh postgres
./scripts/logs.sh nginx

# Backup database
./scripts/backup.sh

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Restart single service
docker compose -f docker-compose.prod.yml restart api

# Stop everything
docker compose -f docker-compose.prod.yml down

# Check service status
docker compose -f docker-compose.prod.yml ps

# Check disk usage
docker system df
```

## Actualizar ForgeAI

```bash
cd /opt/forgeai
git pull origin main
./scripts/deploy.sh TU_IP
```

The deploy script detects the existing `.env` and preserves your secrets.

## Backups

### Manual Backup
```bash
./scripts/backup.sh
# Creates: /opt/forgeai/backups/forgeai_20240101_120000.sql.gz
```

### Automated Daily Backup
```bash
# Add to forgeai user's crontab:
crontab -e
# Add this line:
0 2 * * * /opt/forgeai/scripts/backup.sh >> /opt/forgeai/backups/cron.log 2>&1
```

### Restore from Backup
```bash
gunzip -c /opt/forgeai/backups/forgeai_20240101_120000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U forgeai forgeai
```

## Troubleshooting

| Problem | Solution |
| ------- | -------- |
| Can't access `http://TU_IP` | Check firewall: `sudo ufw status`. Verify nginx: `docker compose ps nginx` |
| Build fails with OOM | Swap may not be active: `sudo swapon --show`. Re-run `server-setup.sh` |
| API returns 502 | API container may be starting: `./scripts/logs.sh api`. Wait 30 seconds |
| Database connection error | Check postgres: `docker compose ps postgres`. Check `DATABASE_URL` in `.env` |
| WebSocket disconnects | Check nginx logs: `./scripts/logs.sh nginx`. Verify `proxy_read_timeout` |
| "Credits depleted" error | User needs a higher plan or credit reset in the database |
| Images not building | Check disk space: `df -h`. Clean: `docker system prune -f` |

## Server Sizing Guide

| Users | Droplet Plan | Monthly Cost |
| ----- | ------------ | ------------ |
| 1-10  | 4 GB / 2 CPU | $24/mo |
| 10-50 | 8 GB / 4 CPU | $48/mo |
| 50+   | 16 GB / 8 CPU | $96/mo |

The main bottleneck is memory during Docker builds and AI agent processing. For development/demo, the $24/mo plan is sufficient.
