#!/bin/bash
set -euo pipefail

# ── ForgeAI Server Setup Script ──────────────────────────
# Run as root on a fresh Ubuntu 24.04 server (DigitalOcean Droplet)
# Idempotent: safe to run multiple times
#
# Usage: bash scripts/server-setup.sh

echo "════════════════════════════════════════════════════════"
echo "  ForgeAI — Server Setup"
echo "════════════════════════════════════════════════════════"

# ── 1. System update ─────────────────────────────────────
echo ""
echo "→ Updating system packages..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

# ── 2. Install essential tools ───────────────────────────
echo "→ Installing essential tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  git curl wget htop ufw fail2ban \
  ca-certificates gnupg lsb-release \
  apt-transport-https software-properties-common

# ── 3. Install Docker (official repo) ────────────────────
if command -v docker &> /dev/null; then
  echo "→ Docker already installed: $(docker --version)"
else
  echo "→ Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable docker
systemctl start docker

echo "  Docker: $(docker --version)"
echo "  Compose: $(docker compose version)"

# ── 4. Configure firewall (UFW) ──────────────────────────
echo "→ Configuring firewall..."
ufw --force reset > /dev/null 2>&1 || true
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow OpenSSH > /dev/null
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
ufw --force enable > /dev/null
echo "  Firewall: enabled (SSH, HTTP, HTTPS)"

# ── 5. Configure fail2ban ────────────────────────────────
echo "→ Configuring fail2ban for SSH..."
cat > /etc/fail2ban/jail.local << 'JAIL'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
JAIL

systemctl enable fail2ban
systemctl restart fail2ban
echo "  fail2ban: enabled (SSH brute-force protection)"

# ── 6. Create forgeai user ───────────────────────────────
if id "forgeai" &>/dev/null; then
  echo "→ User 'forgeai' already exists"
else
  echo "→ Creating user 'forgeai'..."
  useradd -m -s /bin/bash -G docker forgeai
  echo "  User 'forgeai' created and added to docker group"
fi

mkdir -p /opt/forgeai
chown forgeai:forgeai /opt/forgeai

mkdir -p /opt/forgeai/backups
chown forgeai:forgeai /opt/forgeai/backups

# ── 7. Configure swap (4GB) ──────────────────────────────
if swapon --show | grep -q '/swapfile'; then
  echo "→ Swap already configured: $(swapon --show | tail -1 | awk '{print $3}')"
else
  echo "→ Configuring 4GB swap..."
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile > /dev/null
  swapon /swapfile

  # Persist across reboots
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi

  # Optimize swap behavior
  sysctl vm.swappiness=10 > /dev/null
  sysctl vm.vfs_cache_pressure=50 > /dev/null
  echo "vm.swappiness=10" >> /etc/sysctl.conf 2>/dev/null || true
  echo "vm.vfs_cache_pressure=50" >> /etc/sysctl.conf 2>/dev/null || true

  echo "  Swap: 4GB configured"
fi

# ── Summary ──────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Server ready!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  IP:         $SERVER_IP"
echo "  Docker:     $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo "  Compose:    $(docker compose version --short)"
echo "  Firewall:   active (SSH, 80, 443)"
echo "  fail2ban:   active (SSH protection)"
echo "  Swap:       $(free -h | awk '/Swap/{print $2}')"
echo "  User:       forgeai (docker group)"
echo "  App dir:    /opt/forgeai"
echo ""
echo "  Next step:"
echo "    su - forgeai"
echo "    cd /opt/forgeai"
echo "    git clone <repo-url> ."
echo "    chmod +x scripts/*.sh"
echo "    ./scripts/deploy.sh $SERVER_IP"
echo ""
