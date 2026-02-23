#!/bin/bash
set -euo pipefail

# ── ForgeAI — Add Domain + SSL ───────────────────────────
# Run as root on the server
#
# Usage: sudo ./scripts/add-domain.sh forgeai.app

if [ $# -lt 1 ]; then
  echo "Usage: sudo $0 <domain>"
  echo "Example: sudo $0 forgeai.app"
  exit 1
fi

DOMAIN="$1"
APP_DIR="/opt/forgeai"
COMPOSE_FILE="docker-compose.prod.yml"
NGINX_CONF="$APP_DIR/nginx/nginx.conf"

echo "════════════════════════════════════════════════════════"
echo "  ForgeAI — Add Domain: $DOMAIN"
echo "════════════════════════════════════════════════════════"

# ── 1. Update nginx server_name ──────────────────────────
echo ""
echo "→ Updating nginx configuration..."
sed -i "s/server_name _;/server_name ${DOMAIN} www.${DOMAIN};/" "$NGINX_CONF"
echo "  server_name set to: $DOMAIN www.$DOMAIN"

# ── 2. Install certbot ──────────────────────────────────
if ! command -v certbot &> /dev/null; then
  echo "→ Installing certbot..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx
fi
echo "  certbot: $(certbot --version 2>&1 | head -1)"

# ── 3. Stop nginx to free port 80 ───────────────────────
echo "→ Stopping nginx for certificate issuance..."
docker compose -f "$APP_DIR/$COMPOSE_FILE" stop nginx

# ── 4. Obtain SSL certificate ───────────────────────────
echo "→ Obtaining SSL certificate for $DOMAIN..."
certbot certonly --standalone \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "admin@${DOMAIN}" \
  --preferred-challenges http

echo "  SSL certificate obtained"

# ── 5. Update nginx for SSL ─────────────────────────────
echo "→ Updating nginx with SSL configuration..."
cat > "$NGINX_CONF" << NGINXEOF
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 50m;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    upstream api {
        server api:8000;
    }

    upstream web {
        server web:3000;
    }

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name ${DOMAIN} www.${DOMAIN};

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://\$host\$request_uri;
        }
    }

    # HTTPS
    server {
        listen 443 ssl http2;
        server_name ${DOMAIN} www.${DOMAIN};

        ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        location /api/ {
            proxy_pass http://api;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_read_timeout 120s;
            proxy_send_timeout 120s;
        }

        location /socket.io/ {
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_read_timeout 3600;
        }

        location /preview/ {
            proxy_pass http://api;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }

        location / {
            proxy_pass http://web;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
NGINXEOF

echo "  nginx.conf updated with SSL"

# ── 6. Update .env ───────────────────────────────────────
echo "→ Updating .env with domain URLs..."
sed -i "s|APP_URL=.*|APP_URL=https://${DOMAIN}|" "$APP_DIR/.env"
sed -i "s|API_URL=.*|API_URL=https://${DOMAIN}|" "$APP_DIR/.env"
sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://${DOMAIN}|" "$APP_DIR/.env"
sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://${DOMAIN}|" "$APP_DIR/.env"
sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://${DOMAIN}|" "$APP_DIR/.env"
sed -i "s|NEXT_PUBLIC_WS_URL=.*|NEXT_PUBLIC_WS_URL=wss://${DOMAIN}|" "$APP_DIR/.env"
echo "  .env updated"

# ── 7. Mount SSL certs in docker-compose ─────────────────
# The docker-compose already mounts ./nginx/ssl, but we need letsencrypt
# We'll add it via a volume override
echo "→ Rebuilding web service (NEXT_PUBLIC_ vars changed)..."
docker compose -f "$APP_DIR/$COMPOSE_FILE" build web 2>&1 | tail -3

# ── 8. Update compose to mount letsencrypt certs ─────────
# Add letsencrypt volume to nginx if not already present
if ! grep -q "letsencrypt" "$APP_DIR/$COMPOSE_FILE"; then
  sed -i '/\.\/nginx\/ssl:\/etc\/nginx\/ssl:ro/a\      - /etc/letsencrypt:/etc/letsencrypt:ro' "$APP_DIR/$COMPOSE_FILE"
  echo "  Added letsencrypt volume to nginx"
fi

# ── 9. Restart everything ────────────────────────────────
echo "→ Restarting services..."
docker compose -f "$APP_DIR/$COMPOSE_FILE" up -d --remove-orphans

# ── 10. Setup auto-renewal ───────────────────────────────
echo "→ Setting up SSL auto-renewal..."
CRON_CMD="0 3 * * * certbot renew --quiet --deploy-hook 'docker compose -f $APP_DIR/$COMPOSE_FILE restart nginx'"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_CMD") | crontab -
echo "  Auto-renewal cron: daily at 3 AM"

# ── Summary ──────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Domain configured!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  URL:    https://$DOMAIN"
echo "  API:    https://$DOMAIN/api/health"
echo "  SSL:    Let's Encrypt (auto-renew enabled)"
echo ""
