# Session Briefing — S84: Print Agent, Screensaver, Deploy Pipeline
**Date:** March 28, 2026
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`)
**Branch:** `main`
**Resume:** `ab52713` on main

---

## Session Summary

Built the TERM03 print agent, receipt print button, screensaver, and one-command deploy pipeline. Both terminals now have working receipt printers, a branded screensaver on idle, and can be managed entirely from the Mac via `./deploy.sh`.

**Starting state:** S83 complete — ESC/POS driver on TERM02, server printer API, receipt preview modal. TERM03 had no printer support. No screensaver. Manual SSH deploys with passwords.

**Ending state:** Both terminals printing receipts, screensaver active after 30s idle, full deploy/shutdown/reboot/status management from Mac with zero passwords.

---

## What Was Built

### 1. Print Agent (`print-agent/`)
Standalone Node.js service for terminals without the full POS server. Drives local RP-630 USB printer via `usb` npm package.

- `agent.js` — HTTP server on port 3001 with `/print/test`, `/print/receipt`, `/print/open-drawer`, `/print/status`
- `escpos.js` — copy of ESC/POS driver (kept in sync with `server/printer/escpos.js`)
- `riddim-print-agent.service` — systemd unit, runs as cipher user
- Deployed to `/home/cipher/print-agent/` on TERM03

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

### 7. Infrastructure
- **SSH keys** — Mac → TERM02 and TERM03, no password prompts
- **Passwordless sudo** — `/etc/sudoers.d/riddim-deploy` on both terminals for `systemctl restart` (riddim-pos, riddim-print-agent, lightdm) and `shutdown`
- **Timezone** — both terminals set to `America/New_York`
- **Terminal name** — URL param `?terminal=TERM02` in kiosk-start.sh, shown on login screen
- **Refresh button** — subtle ↻ button top-right of login screen for UI reload without SSH (tested, confirmed working — deploy to server, tap refresh, UI updates instantly)
- **Station selector removed** from login screen — replaced with terminal name
- **Custom confirm modal** — replaced browser `confirm()` (which showed server IP) with styled `posConfirm()` using RIDDIM modal system. Applied to day close and table reopen dialogs.

---

## Files Changed

| File | Change |
|---|---|
| `print-agent/agent.js` | NEW — standalone print agent HTTP server |
| `print-agent/escpos.js` | NEW — ESC/POS driver copy |
| `print-agent/package.json` | NEW — minimal deps (usb) |
| `print-agent/riddim-print-agent.service` | NEW — systemd unit |
| `deploy.sh` | NEW — terminal management script |
| `server/routes/printer.js` | Rewritten — IP-based routing, remote proxy |
| `server/printer/escpos.js` | 42-column width for 80mm paper |
| `terminal/js/receipt.js` | PRINT button handler, `_lastReceiptTab` |
| `terminal/js/screensaver.js` | NEW — idle screensaver logic |
| `terminal/js/login.js` | Screensaver hooks, terminal name display |
| `terminal/js/core.js` | `TERMINAL_NAME` from URL param, `posConfirm()` custom dialog |
| `terminal/js/mgmt-operations.js` | Day close uses `posConfirm()` instead of `confirm()` |
| `terminal/js/tables.js` | Table reopen uses `posConfirm()` instead of `confirm()` |
| `shared/css/modals.css` | Confirm button styles |
| `terminal/css/screensaver.css` | NEW — breathing logo animation |
| `terminal/css/receipt.css` | `.receipt-print-btn` styles |
| `terminal/css/login.css` | `.login-refresh-btn` styles |
| `terminal/index.html` | Screensaver overlay, print button, refresh button, removed station selector |
| `terminal/assets/logo-riddim.svg` | NEW — SVG logo (kept but unused, using HTML text instead) |
| `provisioning/setup-terminal.sh` | Step 9: print agent install, timezone, Node.js + libusb deps |

---

## Terminal State

| Terminal | IP | Printer | Print Method | Screensaver | Kiosk URL |
|---|---|---|---|---|---|
| TERM02 | 10.77.2.53 | RP-630 USB | Local (escpos.js) | Working | `http://10.77.2.53:3000/terminal/?terminal=TERM02` |
| TERM03 | 10.77.2.68 | RP-630 USB | Print agent (port 3001) | Working | `http://10.77.2.53:3000/terminal/?terminal=TERM03` |

---

## What's Next

> **Resume at commit `ab52713` on main.**

### Immediate
1. **Stripe Terminal (Phase 3)** — register BBPOS reader to Stripe account, integrate Stripe Terminal SDK for real card payments
2. **Supabase DDL** — create `pos_paid_outs_sync` table (SQL provided in S81 briefing)

### Deferred
3. **KDS (Phase 4)** — kitchen/bar display routing
4. **Inventory Integration (Phase 6)** — sales → theoretical usage via pos_item_id bridge
5. **Fingerprint auth** — U.are.U 4500 + libfprint enrollment
6. **TERM02 kiosk Socket.IO** — shows "OFFLINE" badge when loading from own IP
7. **QR scanner** — USB barcode scanner for member check-in / ticket scan
