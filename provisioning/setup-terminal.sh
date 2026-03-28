#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
# RIDDIM POS Terminal Provisioner
# Wipes users, creates cipher (admin) + kiosk (POS)
# Target: Ubuntu 22.04 LTS on Elo EloPOS / AIO POS
# ═══════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
POS_SERVER_URL="${POS_SERVER_URL:-http://192.168.1.100:3000/terminal/}"
TERMINAL_NAME="${1:-TERM03}"

echo "═══════════════════════════════════════════"
echo "  RIDDIM POS Terminal Provisioner"
echo "  Terminal: $TERMINAL_NAME"
echo "  POS Server: $POS_SERVER_URL"
echo "═══════════════════════════════════════════"
echo ""

# Must run as root
if [[ $EUID -ne 0 ]]; then
  echo "ERROR: Run with sudo"
  exit 1
fi

# ─── 0. Fix DNS (ctrl-mgmt VLAN doesn't resolve) ─
echo "[0/8] Ensuring DNS resolution..."
if ! ping -c1 -W2 archive.ubuntu.com &>/dev/null; then
  echo "  DNS not working — adding Google DNS..."
  echo "nameserver 8.8.8.8" > /etc/resolv.conf
  echo "nameserver 8.8.4.4" >> /etc/resolv.conf
fi

# Persist DNS across reboots via systemd-resolved
mkdir -p /etc/systemd/resolved.conf.d
cat > /etc/systemd/resolved.conf.d/dns.conf << 'DNS'
[Resolve]
DNS=8.8.8.8 8.8.4.4
FallbackDNS=1.1.1.1
DNS
systemctl restart systemd-resolved 2>/dev/null || true

# ─── 1. System Update ───────────────────────────
echo "[1/8] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ─── 2. Install Dependencies ────────────────────
echo "[2/8] Installing dependencies..."
apt-get install -y -qq \
  chromium-browser \
  xinit \
  openbox \
  xdotool \
  unclutter \
  lightdm \
  plymouth \
  network-manager \
  openssh-server \
  curl \
  git \
  htop \
  vim \
  xinput

# ─── 3. Create Admin User (cipher) ──────────────
echo "[3/8] Creating admin user: cipher..."
if id "cipher" &>/dev/null; then
  echo "  User cipher already exists, updating password..."
  echo "cipher:cipher" | chpasswd
else
  useradd -m -s /bin/bash -G sudo,adm,video,input cipher
  echo "cipher:cipher" | chpasswd
fi

# ─── 4. Create Kiosk User ───────────────────────
echo "[4/8] Creating kiosk user..."
if id "kiosk" &>/dev/null; then
  echo "  User kiosk already exists..."
else
  useradd -m -s /bin/bash -G video,input kiosk
  # No password — auto-login only
  passwd -d kiosk
fi

# ─── 5. Configure Auto-Login (kiosk) ────────────
echo "[5/8] Configuring auto-login for kiosk user..."

# LightDM auto-login
mkdir -p /etc/lightdm/lightdm.conf.d
cat > /etc/lightdm/lightdm.conf.d/50-kiosk.conf << 'LIGHTDM'
[Seat:*]
autologin-user=kiosk
autologin-user-timeout=0
user-session=kiosk-pos
LIGHTDM

# ─── 6. Create Kiosk Session ────────────────────
echo "[6/8] Creating kiosk X session..."

# Xsession desktop entry
cat > /usr/share/xsessions/kiosk-pos.desktop << 'DESKTOP'
[Desktop Entry]
Name=RIDDIM POS Kiosk
Comment=POS Terminal Kiosk Mode
Exec=/usr/local/bin/kiosk-start.sh
Type=Application
DESKTOP

# Kiosk startup script
cat > /usr/local/bin/kiosk-start.sh << KIOSK
#!/usr/bin/env bash
# RIDDIM POS Kiosk — launches Chromium in fullscreen to POS server

# Disable screen blanking / power management
xset s off
xset s noblank
xset -dpms

# Hide cursor after 3 seconds idle
unclutter -idle 3 -root &

# Wait for network (up to 30s)
for i in \$(seq 1 30); do
  if ping -c1 -W1 \$(echo "$POS_SERVER_URL" | sed 's|http://||;s|:.*||') &>/dev/null; then
    break
  fi
  sleep 1
done

# Clear any previous Chromium crash flags
CHROMIUM_DIR="/home/kiosk/.config/chromium"
mkdir -p "\$CHROMIUM_DIR/Default"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "\$CHROMIUM_DIR/Default/Preferences" 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "\$CHROMIUM_DIR/Default/Preferences" 2>/dev/null || true

# Launch Chromium in kiosk mode
exec chromium-browser \\
  --kiosk \\
  --no-first-run \\
  --disable-translate \\
  --disable-infobars \\
  --disable-suggestions-service \\
  --disable-save-password-bubble \\
  --disable-session-crashed-bubble \\
  --disable-component-update \\
  --noerrdialogs \\
  --no-default-browser-check \\
  --autoplay-policy=no-user-gesture-required \\
  --check-for-update-interval=31536000 \\
  --touch-events=enabled \\
  --overscroll-history-navigation=0 \\
  --disable-pinch \\
  --window-position=0,0 \\
  "$POS_SERVER_URL"
KIOSK
chmod +x /usr/local/bin/kiosk-start.sh

# ─── 7. Configure System ────────────────────────
echo "[7/8] Configuring system..."

# Set hostname
hostnamectl set-hostname "$TERMINAL_NAME"
echo "127.0.0.1  $TERMINAL_NAME" >> /etc/hosts

# Disable automatic updates (POS terminals should be manually updated)
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'APT'
APT::Periodic::Update-Package-Lists "0";
APT::Periodic::Unattended-Upgrade "0";
APT::Periodic::Download-Upgradeable-Packages "0";
APT::Periodic::AutocleanInterval "0";
APT::Periodic::Automatic-Reboot "false";
APT::Periodic::Automatic-Reboot-WithUsers "false";
APT::Periodic::RandomSleep "0";
APT::Periodic::Enable "0";
APT
systemctl disable unattended-upgrades 2>/dev/null || true
systemctl stop unattended-upgrades 2>/dev/null || true

# Enable SSH for remote management
systemctl enable ssh

# Persist DHCP networking across reboots
cat > /etc/netplan/01-netcfg.yaml << 'NETPLAN'
network:
  version: 2
  ethernets:
    enp3s0:
      dhcp4: true
NETPLAN
chmod 600 /etc/netplan/01-netcfg.yaml
netplan apply 2>/dev/null || true

# Touch screen — ensure libinput is handling touch
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/40-touchscreen.conf << 'XORG'
Section "InputClass"
    Identifier "calibration"
    MatchIsTouchscreen "on"
    Driver "libinput"
    Option "CalibrationMatrix" "1 0 0 0 1 0 0 0 1"
    Option "TransformationMatrix" "1 0 0 0 1 0 0 0 1"
EndSection
XORG

# Prevent screen rotation on touch
cat > /etc/X11/xorg.conf.d/50-no-rotate.conf << 'XORG'
Section "Monitor"
    Identifier "default"
    Option "Rotate" "normal"
EndSection
XORG

# ─── 8. POS Server Connection Config ────────────
echo "[8/8] Writing POS connection config..."

mkdir -p /home/kiosk/.config/riddim-pos
cat > /home/kiosk/.config/riddim-pos/terminal.conf << CONF
# RIDDIM POS Terminal Configuration
POS_SERVER_URL=$POS_SERVER_URL
TERMINAL_NAME=$TERMINAL_NAME
CONF
chown -R kiosk:kiosk /home/kiosk/.config

# Admin helper scripts
mkdir -p /home/cipher/bin

cat > /home/cipher/bin/pos-status << 'STATUS'
#!/usr/bin/env bash
echo "═══ RIDDIM POS Terminal Status ═══"
echo "Hostname: $(hostname)"
echo "IP: $(hostname -I | awk '{print $1}')"
echo "Uptime: $(uptime -p)"
echo "Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"
echo "RAM: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
source /home/kiosk/.config/riddim-pos/terminal.conf 2>/dev/null
echo "POS Server: ${POS_SERVER_URL:-not configured}"
echo "Kiosk session: $(systemctl is-active lightdm)"
STATUS
chmod +x /home/cipher/bin/pos-status

cat > /home/cipher/bin/pos-restart << 'RESTART'
#!/usr/bin/env bash
echo "Restarting kiosk session..."
sudo systemctl restart lightdm
RESTART
chmod +x /home/cipher/bin/pos-restart

cat > /home/cipher/bin/pos-set-server << 'SETSERVER'
#!/usr/bin/env bash
if [ -z "$1" ]; then
  echo "Usage: pos-set-server http://192.168.1.100:3000"
  exit 1
fi
sudo sed -i "s|POS_SERVER_URL=.*|POS_SERVER_URL=$1|" /home/kiosk/.config/riddim-pos/terminal.conf
# Update kiosk script
sudo sed -i "s|http://[^\"]*|$1|" /usr/local/bin/kiosk-start.sh
echo "POS server set to: $1"
echo "Run: pos-restart to apply"
SETSERVER
chmod +x /home/cipher/bin/pos-set-server

# Add bin to cipher's PATH
echo 'export PATH="$HOME/bin:$PATH"' >> /home/cipher/.bashrc
chown -R cipher:cipher /home/cipher

echo ""
echo "═══════════════════════════════════════════"
echo "  PROVISIONING COMPLETE"
echo ""
echo "  Admin:  cipher / cipher"
echo "  Kiosk:  auto-login, POS fullscreen"
echo "  Server: $POS_SERVER_URL"
echo "  Host:   $TERMINAL_NAME"
echo ""
echo "  Rebooting in 5 seconds..."
echo "═══════════════════════════════════════════"

sleep 5
reboot
