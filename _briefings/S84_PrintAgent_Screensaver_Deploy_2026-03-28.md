# Session Briefing — S84: Print Agent, Screensaver, Deploy Pipeline
**Date:** March 28, 2026
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`) + RIDDIM Platform (`~/ctrl/riddimsupperclub`)
**Branch:** `main` (both repos)
**Resume:** `8d41e13` (riddim-pos) / `8e7eab9` (riddimsupperclub) on main

---

## Session Summary

Built the TERM03 print agent, receipt print button, screensaver, one-command deploy pipeline, custom confirm modal, clear test data API, and BOH portal POS server connectivity. Both terminals now have working receipt printers, a branded screensaver on idle, and can be managed entirely from the Mac via `./deploy.sh`.

**Starting state:** S83 complete — ESC/POS driver on TERM02, server printer API, receipt preview modal. TERM03 had no printer support. No screensaver. Manual SSH deploys with passwords.

**Ending state:** Both terminals printing receipts (42-col/80mm), screensaver active after 30s idle, full deploy/shutdown/reboot/status management from Mac with zero passwords. Clear test data API on server. BOH portal has POS server IP in detection list + Clear Data button (blocked by Chrome networking issue — see Known Issues).

---

## What Was Built

### 1. Print Agent (`print-agent/`)
Standalone Node.js service for terminals without the full POS server. Drives local RP-630 USB printer via `usb` npm package.

- `agent.js` — HTTP server on port 3001 with `/print/test`, `/print/receipt`, `/print/open-drawer`, `/print/status`
- `escpos.js` — copy of ESC/POS driver (kept in sync with `server/printer/escpos.js`)
- `riddim-print-agent.service` — systemd unit, runs as cipher user
- Deployed to `/home/cipher/print-agent/` on TERM03
- Required Node 20 install via NodeSource (Ubuntu 22.04 default is v12)

### 2. Server Print Proxy (`server/routes/printer.js`)
Server detects client IP and routes print jobs accordingly:
- Local requests (TERM02, 127.0.0.1, 10.77.2.53) → print directly via USB
- Remote requests (TERM03+) → proxy to `http://{clientIP}:3001/print/*`

### 3. Receipt Print Button (`terminal/js/receipt.js`)
- PRINT button added to receipt modal (gold outline, left of CLOSE)
- `printReceipt()` sends tab data via `serverPost('/api/printer/receipt')`
- Button shows "PRINTING..." while working, toast on success/failure
- `_lastReceiptTab` stores tab data between showing and printing

### 4. Receipt Formatting Fix
- Changed from 32-column (58mm) to 42-column (80mm) width
- Separator and `row()` function updated to match RP-630 paper width

### 5. Screensaver (`terminal/js/screensaver.js` + `terminal/css/screensaver.css`)
- Breathing RIDDIM logo (Cormorant Garamond) + SUPPER CLUB subtitle + clock
- Activates after 30 seconds idle on login screen
- Dismissed by any touch/click/keypress
- Full-screen overlay, z-index 9999, cursor hidden

### 6. Deploy Pipeline (`deploy.sh`)
One-command terminal management from Mac:
- `./deploy.sh` — full deploy (git pull TERM02, scp print-agent TERM03, restart all services + kiosks)
- `./deploy.sh shutdown` — power off both terminals
- `./deploy.sh reboot` — reboot both
- `./deploy.sh restart` — restart services only
- `./deploy.sh status` — check if terminals are online

### 7. Custom Confirm Modal (`posConfirm()`)
- Replaced browser `confirm()` which showed server IP address (10.77.2.53:3000)
- Styled modal using existing RIDDIM modal system
- Applied to day close and table reopen dialogs

### 8. Clear Test Data API
- `POST /api/orders/clear-all` — deletes all orders, lines, payments, paid outs, sessions, audit logs, clock entries from local PG
- Transactional (all-or-nothing)
- BOH portal has Clear Data button under Config > Settings (red panel)
- Currently only callable via curl/SSH due to Chrome networking issue

### 9. Infrastructure
- **SSH keys** — Mac → TERM02 and TERM03, no password prompts
- **Passwordless sudo** — `/etc/sudoers.d/riddim-deploy` on both terminals for `systemctl restart` (riddim-pos, riddim-print-agent, lightdm) and `shutdown`
- **Timezone** — both terminals set to `America/New_York`
- **Terminal name** — URL param `?terminal=TERM02` in kiosk-start.sh, shown on login screen
- **Refresh button** — subtle ↻ button top-right of login screen for UI reload without SSH (tested, confirmed working)
- **Station selector removed** from login screen — replaced with terminal name
- **BOH portal** — added `http://10.77.2.53:3000` to `POS_SERVER_URLS` array

---

## Files Changed

### riddim-pos
| File | Change |
|---|---|
| `print-agent/agent.js` | NEW — standalone print agent HTTP server |
| `print-agent/escpos.js` | NEW — ESC/POS driver copy (42-col) |
| `print-agent/package.json` | NEW — minimal deps (usb) |
| `print-agent/riddim-print-agent.service` | NEW — systemd unit |
| `deploy.sh` | NEW — terminal management script |
| `server/routes/printer.js` | Rewritten — IP-based routing, remote proxy |
| `server/routes/orders.js` | Added `POST /clear-all` for test data wipe |
| `server/printer/escpos.js` | 42-column width for 80mm paper |
| `server/index.js` | Minor (reverted BOH static serving) |
| `terminal/js/receipt.js` | PRINT button handler, `_lastReceiptTab` |
| `terminal/js/screensaver.js` | NEW — idle screensaver logic |
| `terminal/js/login.js` | Screensaver hooks, terminal name display |
| `terminal/js/core.js` | `TERMINAL_NAME` from URL param, `posConfirm()` custom dialog |
| `terminal/js/mgmt-operations.js` | Day close uses `posConfirm()` |
| `terminal/js/tables.js` | Table reopen uses `posConfirm()` |
| `terminal/css/screensaver.css` | NEW — breathing logo animation |
| `terminal/css/receipt.css` | `.receipt-print-btn` styles |
| `terminal/css/login.css` | `.login-refresh-btn` styles |
| `shared/css/modals.css` | Confirm button styles |
| `terminal/index.html` | Screensaver overlay, print button, refresh button, confirm modal, removed station selector |
| `terminal/assets/logo-riddim.svg` | NEW — SVG logo (kept but unused, using HTML text instead) |
| `provisioning/setup-terminal.sh` | Step 9: print agent install, timezone, Node.js + libusb deps |

### riddimsupperclub
| File | Change |
|---|---|
| `docs/boh/index.html` | Added `10.77.2.53:3000` to POS_SERVER_URLS, Clear Data button + `clearPosData()` |

---

## Terminal State

| Terminal | IP | Printer | Print Method | Screensaver | Kiosk URL |
|---|---|---|---|---|---|
| TERM02 | 10.77.2.53 | RP-630 USB | Local (escpos.js) | Working | `http://10.77.2.53:3000/terminal/?terminal=TERM02` |
| TERM03 | 10.77.2.68 | RP-630 USB | Print agent (port 3001) | Working | `http://10.77.2.53:3000/terminal/?terminal=TERM03` |

---

## Known Issues

### Chrome can't reach POS server (ERR_ADDRESS_UNREACHABLE)
Chrome on Mac cannot reach `http://10.77.2.53:3000` even though `curl` works fine from the same machine. This blocks the BOH portal from connecting to the POS server for reports, audit, transactions, and clear data. Likely caused by Cloudflare WARP, a VPN, or Chrome proxy settings routing browser traffic differently than terminal. The `chrome://flags/#unsafely-treat-insecure-origin-as-secure` flag was set but didn't fix the underlying connectivity issue.

**Workaround:** Use SSH + curl to interact with POS server API:
```bash
ssh cipher@10.77.2.53 "curl -s -X POST http://localhost:3000/api/orders/clear-all"
```

**To investigate:** Check for Cloudflare WARP in menu bar, `chrome://settings/system` for proxy, or Chrome extensions that modify network routing.

---

## What's Next

> **Resume at commit `8d41e13` (riddim-pos) / `8e7eab9` (riddimsupperclub) on main.**

### Immediate
1. **Chrome networking** — fix ERR_ADDRESS_UNREACHABLE so BOH portal can reach POS server
2. **Clear test data** — run clear-all via SSH before going live
3. **Stripe Terminal (Phase 3)** — register BBPOS reader to Stripe account, integrate Stripe Terminal SDK for real card payments
4. **Supabase DDL** — create `pos_paid_outs_sync` table (SQL provided in S81 briefing)

### Deferred
5. **KDS (Phase 4)** — kitchen/bar display routing
6. **Inventory Integration (Phase 6)** — sales → theoretical usage via pos_item_id bridge
7. **Fingerprint auth** — U.are.U 4500 + libfprint enrollment
8. **TERM02 kiosk Socket.IO** — shows "OFFLINE" badge when loading from own IP
9. **QR scanner** — USB barcode scanner for member check-in / ticket scan
