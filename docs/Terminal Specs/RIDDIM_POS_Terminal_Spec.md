# RIDDIM POS — Terminal Hardware & Configuration Spec
**AG Entertainment | March 2026**
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CLOUD (Supabase)                   │
│  Members, Events, Menu, Inventory, P&L, Bookings    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS sync
┌──────────────────────┴──────────────────────────────┐
│              MAC MINI M4 (server)                    │
│  macOS · Node.js · PostgreSQL · BOH Portal           │
│  Fingerprint enrollment · Socket.IO hub              │
│  http://mac-mini.local:3000                          │
└──────┬───────┬───────┬───────┬───────┬──────────────┘
       │       │       │       │       │  LAN (Socket.IO)
    ┌──┴──┐ ┌──┴──┐ ┌──┴──┐ ┌──┴──┐ ┌──┴──┐
    │BAR1 │ │BAR2 │ │BAR3 │ │BAR4 │ │ SVC │  Elo EloPOS 22"
    │ FP  │ │ FP  │ │ FP  │ │ FP  │ │ FP  │  Linux · Chrome kiosk
    │S700 │ │S700 │ │S700 │ │S700 │ │S700 │  U.are.U 4500 + Stripe S700
    └─────┘ └─────┘ └─────┘ └─────┘ └─────┘
```

---

## 2. Terminal Hardware

### Primary Terminal — Elo EloPOS 22" AIO

| Spec | Detail |
|---|---|
| Model | Elo EloPOS System 22" |
| Display | 21.5" capacitive touchscreen |
| OS | Linux (Ubuntu 24.04 LTS) |
| Processor | Intel Core i5 (8th gen), 2.1 GHz, 6-core |
| RAM | 8 GB DDR4 |
| Storage | 128 GB SSD |
| Connectivity | Ethernet (RJ45), Wi-Fi 802.11ac, Bluetooth |
| Ports | USB-A (expansion hub), USB-C (DisplayPort alt), serial |
| Expansion Hub | Integrated into stand — USB-A x4, cash drawer, serial |
| Build | Splash-proof, retail-hardened, IP-rated bezel |
| Mounting | VESA compatible — countertop stand, pole, or wall |
| Warranty | 3-year standard (extendable to 5) |
| Qty Needed | 5 (BAR1, BAR2, BAR3, BAR4, SVC) |

### Peripherals — Per Station

| Device | Model | Connection | Qty |
|---|---|---|---|
| Fingerprint reader | Digital Persona U.are.U 4500 | USB-A | 5 + 1 spare |
| Card reader | Stripe Reader S700 | USB or LAN | 5 |
| Receipt printer | Epson TM-T88VII (shared) | Ethernet LAN | 3 total |

### Infrastructure

| Device | Model | Qty |
|---|---|---|
| Server | Mac Mini M4 (16GB / 512GB SSD) | 1 |
| UPS (terminals) | APC Back-UPS BE600M1 (600VA) | 5 |
| UPS (server) | APC Back-UPS BR1500MS2 (1500VA) | 1 |
| Network switch | Ubiquiti USW-Lite-16-PoE (16-port GbE) | 1 |

---

## 3. Pricing Estimate

| Item | Qty | Unit Price | Subtotal |
|---|---|---|---|
| Elo EloPOS 22" (Linux, i5) | 5 | $1,350 | $6,750 |
| U.are.U 4500 fingerprint reader | 6 | $70 | $420 |
| Stripe Reader S700 | 5 | $349 | $1,745 |
| Epson TM-T88VII receipt printer | 3 | $400 | $1,200 |
| APC Back-UPS BE600M1 | 5 | $75 | $375 |
| APC Back-UPS BR1500MS2 | 1 | $220 | $220 |
| Ubiquiti USW-Lite-16-PoE | 1 | $140 | $140 |
| Mac Mini M4 (16GB/512GB) | 1 | $599 | $599 |
| Cabling, mounts, misc | — | — | $300 |
| **TOTAL** | | | **$11,749** |

*Note: Elo terminal pricing based on Amazon listing ($1,350). Shop for volume/refurb deals to reduce. Budget version with refurb terminals could bring total to ~$8,000–$9,000.*

---

## 4. Linux OS Configuration

### Base Install
- **Ubuntu Desktop 24.04 LTS** (Long Term Support through 2029)
- Minimal install (no office suite, no games)
- Auto-updates disabled (manual updates during off-hours only)

### Required Packages

| Package | Purpose |
|---|---|
| `google-chrome-stable` | Terminal UI browser (kiosk mode) |
| `nodejs` (v20 LTS) | Fingerprint agent service |
| `libfprint-2-2` | Open-source U.are.U 4500 driver |
| `openssh-server` | Remote management from Mac Mini |
| `iptables` / `ufw` | Firewall — network lockdown |
| `unclutter` | Hides mouse cursor after idle |

---

## 5. User Accounts

Each terminal has two Linux user accounts with distinct access levels.

### `admin` — IT / Management

| Setting | Value |
|---|---|
| Login | Manual (select at login screen or TTY) |
| Desktop | Full Ubuntu GNOME desktop |
| Permissions | sudo, full filesystem, install software |
| Network | Unrestricted |
| Access method | Direct login, SSH from Mac Mini |
| Who knows password | Owner / IT only |

**Use cases:**
- Initial OS setup and configuration
- Software updates and troubleshooting
- Network and firewall changes
- Fingerprint agent updates
- Chrome and driver updates

### `terminal` — Staff / POS Kiosk

| Setting | Value |
|---|---|
| Login | Auto-login on boot (no password prompt) |
| Desktop | None — Chrome IS the window manager |
| Permissions | No sudo, no filesystem access |
| Network | Whitelisted IPs only (see firewall rules) |
| Keyboard | Alt-Tab, Alt-F4, Ctrl-Alt-Del, Super key all disabled |
| Access method | Touchscreen only (no external keyboard expected) |

**What staff sees:**
1. Terminal powers on
2. Linux boots (~10 seconds)
3. Chrome opens fullscreen → `http://mac-mini.local:3000/terminal/`
4. Fingerprint scan prompt appears
5. Staff scans finger → POS session starts

**What staff CANNOT do:**
- Exit or minimize Chrome
- Access the Linux desktop, file manager, or settings
- Open other applications or browser tabs
- Change network or system settings
- Access any URL other than whitelisted endpoints

---

## 6. Chrome Kiosk Configuration

### Launch Command (systemd service)
```bash
/usr/bin/google-chrome-stable \
  --kiosk \
  --app=http://mac-mini.local:3000/terminal/ \
  --noerrdialogs \
  --disable-translate \
  --no-first-run \
  --fast \
  --fast-start \
  --disable-infobars \
  --disable-features=TranslateUI \
  --disk-cache-dir=/tmp/chrome-cache \
  --password-store=basic \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required
```

### Systemd Service (`/etc/systemd/system/pos-kiosk.service`)
```ini
[Unit]
Description=RIDDIM POS Terminal Kiosk
After=network-online.target pos-fingerprint.service
Wants=network-online.target

[Service]
Type=simple
User=terminal
Environment=DISPLAY=:0
ExecStart=/usr/bin/google-chrome-stable --kiosk --app=http://mac-mini.local:3000/terminal/ --noerrdialogs --disable-translate --no-first-run --disable-infobars --disable-features=TranslateUI --disable-pinch
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical.target
```

### Disable Keyboard Shortcuts (GNOME)
```bash
# Run as terminal user
gsettings set org.gnome.desktop.wm.keybindings switch-applications "[]"
gsettings set org.gnome.desktop.wm.keybindings close "[]"
gsettings set org.gnome.desktop.wm.keybindings minimize "[]"
gsettings set org.gnome.desktop.wm.keybindings toggle-fullscreen "[]"
gsettings set org.gnome.mutter.keybindings toggle-tiled-left "[]"
gsettings set org.gnome.mutter.keybindings toggle-tiled-right "[]"
```

---

## 7. Fingerprint Agent

A lightweight Node.js service runs on each terminal, bridging the U.are.U 4500 hardware to the POS terminal UI via a localhost HTTP API.

### Service (`/etc/systemd/system/pos-fingerprint.service`)
```ini
[Unit]
Description=RIDDIM POS Fingerprint Agent
After=network.target

[Service]
Type=simple
User=terminal
WorkingDirectory=/opt/riddim-pos/fingerprint-agent
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=3
Environment=PORT=9100

[Install]
WantedBy=multi-user.target
```

### API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `localhost:9100/capture` | POST | Capture fingerprint, return template |
| `localhost:9100/health` | GET | Agent + reader status check |

### Auth Flow
1. Chrome loads POS terminal UI
2. UI shows "Scan your finger" prompt
3. Staff places finger on U.are.U 4500
4. JS calls `localhost:9100/capture` → returns fingerprint template
5. Template sent to Mac Mini server via Socket.IO
6. Server matches against `staff_fingerprints` table in local PG
7. Match found → session starts, terminal UI unlocks
8. No match → "Try again" prompt

### Enrollment Flow (BOH Portal on Mac Mini)
1. Manager opens BOH Portal → Staff → Enroll Fingerprint
2. Selects staff member
3. Staff places finger on a reader connected to any terminal (or Mac Mini)
4. 3–4 scans captured, averaged into a template
5. Template stored in local PG: `staff_fingerprints(staff_id, template, finger_index, enrolled_at)`
6. Confirmation shown — staff can now log in at any terminal

---

## 8. Firewall Rules (terminal user)

### Whitelisted Outbound Connections

| Destination | Port | Protocol | Purpose |
|---|---|---|---|
| `mac-mini.local` (server IP) | 3000 | TCP (HTTP/WS) | POS UI + Socket.IO |
| `localhost` | 9100 | TCP (HTTP) | Fingerprint agent |
| `api.stripe.com` | 443 | TCP (HTTPS) | Stripe payment processing |
| `terminal-api.stripe.com` | 443 | TCP (HTTPS) | Stripe Terminal SDK |
| `pem.stripe.com` | 443 | TCP (HTTPS) | Stripe certificate pinning |
| DNS server | 53 | UDP | Name resolution |

### UFW Configuration
```bash
# Default deny all outbound for terminal user
sudo ufw default deny outgoing

# Allow POS server
sudo ufw allow out to <mac-mini-ip> port 3000 proto tcp

# Allow fingerprint agent (local)
sudo ufw allow out to 127.0.0.1 port 9100 proto tcp

# Allow Stripe API
sudo ufw allow out to any port 443 proto tcp

# Allow DNS
sudo ufw allow out to any port 53

# Enable
sudo ufw enable
```

*Note: Port 443 is broadly allowed for Stripe. For tighter lockdown, restrict to Stripe's published IP ranges.*

---

## 9. Network Topology

```
Internet ←→ [Router/Firewall] ←→ [Ubiquiti Switch]
                                       │
                    ┌──────────────────┤
                    │                  │
              [Mac Mini M4]    [Elo Terminal x5]
              192.168.1.10     192.168.1.101–105
              :3000 server     Chrome kiosk
              :5432 PostgreSQL U.are.U 4500
              BOH Portal       Stripe S700
                    │
              [Epson printers x3]
              192.168.1.201–203
```

### Static IP Assignment

| Device | IP | Hostname |
|---|---|---|
| Mac Mini (server) | 192.168.1.10 | mac-mini.local |
| BAR1 terminal | 192.168.1.101 | bar1.local |
| BAR2 terminal | 192.168.1.102 | bar2.local |
| BAR3 terminal | 192.168.1.103 | bar3.local |
| BAR4 terminal | 192.168.1.104 | bar4.local |
| SVC terminal | 192.168.1.105 | svc.local |
| Printer 1 | 192.168.1.201 | printer1.local |
| Printer 2 | 192.168.1.202 | printer2.local |
| Printer 3 | 192.168.1.203 | printer3.local |

---

## 10. Remote Management

### From Mac Mini → Any Terminal
```bash
# SSH into BAR1
ssh admin@192.168.1.101

# Restart POS kiosk on BAR2
ssh admin@192.168.1.102 "sudo systemctl restart pos-kiosk"

# Restart fingerprint agent on BAR3
ssh admin@192.168.1.103 "sudo systemctl restart pos-fingerprint"

# View Chrome logs on BAR4
ssh admin@192.168.1.104 "journalctl -u pos-kiosk -f"

# Reboot SVC terminal
ssh admin@192.168.1.105 "sudo reboot"
```

### Batch Management (all terminals)
```bash
# Script: restart-all-terminals.sh
for ip in 101 102 103 104 105; do
  ssh admin@192.168.1.$ip "sudo systemctl restart pos-kiosk" &
done
wait
echo "All terminals restarted"
```

---

## 11. Boot Sequence (terminal user — automatic)

```
Power On
  → BIOS/UEFI
  → Ubuntu boots (~10s)
  → Auto-login as 'terminal' user
  → systemd starts pos-fingerprint.service
  → systemd starts pos-kiosk.service
  → Chrome opens fullscreen → mac-mini.local:3000/terminal/
  → "Scan your finger" prompt displayed
  → Staff scans → POS session active

Total boot-to-POS: ~15–20 seconds
```

---

## 12. Switching to Admin Mode

For IT/management access without rebooting:

1. **From Mac Mini:** SSH into the terminal (`ssh admin@192.168.1.10x`)
2. **At the terminal:** Press `Ctrl+Alt+F2` → Linux TTY console → log in as `admin`
3. **Full reboot to admin:** Stop kiosk service, reboot, select `admin` at login screen

Staff has no knowledge of or access to admin mode.

---

## 13. Maintenance Schedule

| Task | Frequency | Method |
|---|---|---|
| Ubuntu security updates | Monthly (off-hours) | SSH batch script |
| Chrome update | Monthly | SSH `apt update && apt upgrade` |
| SSD health check | Quarterly | SSH `smartctl` |
| UPS battery test | Quarterly | Manual / APC software |
| Fingerprint reader cleaning | Weekly | Microfiber cloth |
| Full system backup | Monthly | SSH `rsync` to Mac Mini |

---

## 14. Disaster Recovery

| Scenario | Recovery |
|---|---|
| Terminal SSD failure | Swap SSD, re-image from Mac Mini backup (~30 min) |
| Terminal hardware failure | Swap Elo compute module or replace unit. Chrome kiosk config is a 5-min script. |
| Fingerprint reader failure | Swap spare U.are.U 4500 (USB hot-plug). Fallback: temporary PIN auth in POS UI. |
| Mac Mini server failure | Restore PostgreSQL backup to replacement Mac Mini. Terminals auto-reconnect. |
| Network switch failure | Replace switch. Static IPs mean zero reconfiguration. |
| Power outage | UPS provides 10–15 min runway. Orders saved in local PG (server) survive full outage. |
| Internet outage | POS operates normally (local-first). Cloud sync resumes when internet returns. |
