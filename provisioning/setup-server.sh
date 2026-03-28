#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
# RIDDIM POS Server Provisioner
# Installs Node.js 20, PostgreSQL 16, clones repo,
# configures server to start on boot
# Target: Ubuntu 22.04 LTS on POS terminal AIO
# ═══════════════════════════════════════════════════
set -euo pipefail

TERMINAL_NAME="${1:-TERM-SERVER}"
REPO_URL="https://github.com/ctrlmanagement/riddim-pos.git"
POS_DIR="/opt/riddim-pos"

echo "═══════════════════════════════════════════"
echo "  RIDDIM POS Server Provisioner"
echo "  Terminal: $TERMINAL_NAME"
echo "═══════════════════════════════════════════"
echo ""

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: Run with sudo"
  exit 1
fi

# ─── 0. Fix DNS (ctrl-mgmt VLAN doesn't resolve) ─
echo "[0/9] Ensuring DNS resolution..."
if ! ping -c1 -W2 archive.ubuntu.com &>/dev/null; then
  echo "  DNS not working — adding Google DNS..."
  echo "nameserver 8.8.8.8" > /etc/resolv.conf
  echo "nameserver 8.8.4.4" >> /etc/resolv.conf
fi

mkdir -p /etc/systemd/resolved.conf.d
cat > /etc/systemd/resolved.conf.d/dns.conf << 'DNS'
[Resolve]
DNS=8.8.8.8 8.8.4.4
FallbackDNS=1.1.1.1
DNS
systemctl restart systemd-resolved 2>/dev/null || true

# ─── 1. System Update ───────────────────────────
echo "[1/9] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ─── 2. Install Node.js 20 ──────────────────────
echo "[2/9] Installing Node.js 20..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  Node: $(node --version)"
echo "  npm: $(npm --version)"

# ─── 3. Install PostgreSQL 16 ───────────────────
echo "[3/9] Installing PostgreSQL 16..."
if ! command -v psql &>/dev/null; then
  sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  apt-get update -qq
  apt-get install -y -qq postgresql-16
fi
systemctl enable postgresql
systemctl start postgresql
echo "  PostgreSQL: $(psql --version)"

# ─── 4. Create POS Database ─────────────────────
echo "[4/9] Creating riddim_pos database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='cipher'" | grep -q 1 || \
  sudo -u postgres createuser -s cipher
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='riddim_pos'" | grep -q 1 || \
  sudo -u postgres createdb -O cipher riddim_pos
echo "  Database: riddim_pos (owner: cipher)"

# ─── 5. Install Git + Clone Repo ────────────────
echo "[5/9] Cloning riddim-pos repo..."
apt-get install -y -qq git
if [ -d "$POS_DIR" ]; then
  echo "  Repo already exists at $POS_DIR, pulling latest..."
  cd "$POS_DIR" && git pull origin main
else
  git clone "$REPO_URL" "$POS_DIR"
fi
chown -R cipher:cipher "$POS_DIR"

# ─── 6. Install Server Dependencies ─────────────
echo "[6/9] Installing npm dependencies..."
cd "$POS_DIR/server"
sudo -u cipher npm install --production
echo "  Dependencies installed"

# ─── 7. Create .env File ────────────────────────
echo "[7/9] Writing server .env..."
if [ ! -f "$POS_DIR/server/.env" ]; then
  cat > "$POS_DIR/server/.env" << ENV
PORT=3000
DATABASE_URL=postgresql://cipher@localhost/riddim_pos
SUPABASE_URL=https://cbvryfgrqzdvbqigyrgh.supabase.co
SUPABASE_KEY=REPLACE_WITH_PUBLISHABLE_KEY
SUPABASE_SERVICE_KEY=REPLACE_WITH_SERVICE_KEY
ENV
  chown cipher:cipher "$POS_DIR/server/.env"
  echo "  ⚠  .env created — update SUPABASE_KEY and SUPABASE_SERVICE_KEY manually"
else
  echo "  .env already exists, skipping"
fi

# ─── 8. Create systemd Service ──────────────────
echo "[8/9] Creating riddim-pos systemd service..."
cat > /etc/systemd/system/riddim-pos.service << SERVICE
[Unit]
Description=RIDDIM POS Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=cipher
WorkingDirectory=$POS_DIR/server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable riddim-pos
systemctl start riddim-pos
echo "  Service: riddim-pos (enabled + started)"

# ─── 9. Init Database Schema ────────────────────
echo "[9/9] Initializing database schema..."
cd "$POS_DIR/server"
if [ -f db/schema.sql ]; then
  sudo -u cipher psql riddim_pos < db/schema.sql 2>/dev/null || echo "  Schema already applied or no schema file"
elif [ -f db/init.sql ]; then
  sudo -u cipher psql riddim_pos < db/init.sql 2>/dev/null || echo "  Schema already applied"
else
  echo "  No schema file found — server will auto-create tables on first run"
fi

# ─── Get Server IP ───────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "═══════════════════════════════════════════"
echo "  SERVER PROVISIONING COMPLETE"
echo ""
echo "  POS Server: http://$SERVER_IP:3000"
echo "  Database:   riddim_pos (PostgreSQL 16)"
echo "  Service:    riddim-pos (systemctl)"
echo "  Repo:       $POS_DIR"
echo ""
echo "  Point other terminals to:"
echo "  http://$SERVER_IP:3000/terminal/"
echo ""
echo "  Admin commands:"
echo "    sudo systemctl status riddim-pos"
echo "    sudo systemctl restart riddim-pos"
echo "    journalctl -u riddim-pos -f"
echo "═══════════════════════════════════════════"
