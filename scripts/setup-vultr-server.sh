#!/bin/bash
# ============================================================
# DIVINITTYS — Setup inicial del VPS Vultr
# Ejecutar UNA VEZ como root después de crear el servidor:
#   ssh root@TU_IP_VULTR
#   curl -fsSL https://raw.githubusercontent.com/rekkiem/divinittys/main/scripts/setup-vultr-server.sh | bash
# ============================================================
set -e

DOMAIN="divinittys.cl"
EMAIL="admin@divinittys.cl"   # para certificados SSL
APP_USER="divinittys"
APP_DIR="/opt/divinittys"

echo "🚀 DIVINITTYS — Configurando servidor Vultr"
echo "   Dominio: $DOMAIN"
echo "   Dir: $APP_DIR"
echo ""

# ── 1. Sistema base ──────────────────────────────────────────
echo "📦 1/6 Actualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw fail2ban openssl

# ── 2. Docker + Compose ──────────────────────────────────────
echo "🐳 2/6 Instalando Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker && systemctl start docker
fi
docker --version
docker compose version

# ── 3. Firewall ──────────────────────────────────────────────
echo "🔒 3/6 Configurando firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "   Firewall activo (22, 80, 443)"

# ── 4. Usuario de app ─────────────────────────────────────────
echo "👤 4/6 Creando usuario $APP_USER..."
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
  usermod -aG docker "$APP_USER"
fi

# ── 5. Directorio del proyecto ────────────────────────────────
echo "📁 5/6 Preparando directorio $APP_DIR..."
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# ── 6. Certificado SSL inicial (Let's Encrypt) ────────────────
echo "🔐 6/6 Configurando SSL..."
apt-get install -y -qq certbot

# Obtener certificado (requiere que el dominio apunte a este IP)
certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  -d "media.$DOMAIN" \
  2>/dev/null || echo "⚠️  SSL: asegúrate de que el DNS apunte a este servidor"

# Renovación automática
echo "0 0,12 * * * root certbot renew --quiet" >> /etc/crontab

echo ""
echo "════════════════════════════════════════════════════"
echo "  ✅ Servidor configurado"
echo ""
echo "  Próximo paso — en tu máquina local:"
echo "  git clone https://github.com/rekkiem/divinittys $APP_DIR"
echo "  # o scp/rsync tu código:"
echo "  scp -r . root@TU_IP:$APP_DIR"
echo ""
echo "  Luego desde el servidor:"
echo "  cd $APP_DIR"
echo "  bash scripts/deploy-vultr.sh"
echo "════════════════════════════════════════════════════"
