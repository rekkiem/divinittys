#!/usr/bin/env bash
# ============================================================
# Bootstrap genérico Ubuntu 22.04+ (Hetzner, DigitalOcean,
# Linode, Contabo, AWS Lightsail, Vultr, etc.)
#
# Uso (como root):
#   DOMAIN=midominio.cl EMAIL=admin@midominio.cl bash scripts/setup-vps.sh
# ============================================================
set -euo pipefail

DOMAIN="${DOMAIN:-divinittys.cl}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
APP_USER="${APP_USER:-divinittys}"
APP_DIR="${APP_DIR:-/opt/divinittys}"

echo "🚀 Setup VPS portable — $DOMAIN → $APP_DIR"

apt-get update -qq
apt-get install -y -qq curl git ufw fail2ban openssl ca-certificates

if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
fi
usermod -aG docker "$APP_USER" || true

mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

apt-get install -y -qq certbot
certbot certonly --standalone --non-interactive --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN" -d "www.$DOMAIN" -d "media.$DOMAIN" \
  2>/dev/null || echo "⚠️  SSL pendiente: apunta el DNS A a este servidor y reintenta certbot"

grep -q 'certbot renew' /etc/crontab 2>/dev/null || \
  echo "0 3 * * * root certbot renew --quiet" >> /etc/crontab

echo ""
echo "✅ Servidor listo (provider-agnostic)"
echo "  1) git clone ... $APP_DIR"
echo "  2) cp .env.example .env.production && nano .env.production"
echo "  3) bash scripts/pre-deploy.sh --strict"
echo "  4) bash scripts/deploy.sh --first-time"
