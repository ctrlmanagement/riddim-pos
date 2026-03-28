# Session Briefing — S86: PDF Exports, Role Permissions, Close Day, Staff Management
**Date:** March 28, 2026
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`) + RIDDIM Platform (`~/ctrl/riddimsupperclub`)
**Branch:** `main` (both repos)
**Resume:** `6afe9d2` (riddim-pos) / `ae27adb` (riddimsupperclub) on main

---

## Session Summary

Built universal PDF export across all BOH report types, role-based tab visibility with security group hierarchy, staff management panel (FOH + BOH), tip declaration on checkout, terminal shutdown button, and Close Day redesign with cash deposit entry and CC settle placeholder.

**Starting state:** S85 complete — terminal layout redesign, 22 categories, remote access. No PDF exports on most BOH tabs. No role-based tab filtering. No staff management panel. Close Day lacked cash deposit input.

**Ending state:** All 9 BOH report types + Transactions + Audit have PDF export. Role hierarchy enforced everywhere (owner > gm > manager > bartender > barback). MANAGE STAFF panel on FOH terminal. Tip declaration on checkout. Close Day has cash deposit input with OVER/SHORT display. Terminal has shutdown button. Owner portal POS links fixed.

---

## Commits

### riddim-pos (4 commits, 19 files, +893 lines)
| Hash | Description |
|---|---|
| `5cc7102` | BOH PDF exports, close day from back office, terminal shutdown + clean errors |
| `a4a5354` | Role-based tab visibility + staff management panel + tip declaration |
| `b7cbf51` | Fix role hierarchy — derive level from security group name, not just pos_role |
| `6afe9d2` | Close Day: cash deposit input + CC settle placeholder + OVER/SHORT display |

### riddimsupperclub (2 commits)
| Hash | Description |
|---|---|
| `609e88f` | BOH: PDF exports on all tabs, close day section, owner POS links fixed |
| `ae27adb` | BOH: staff management in Close Day, new permission keys |

---

## What Was Built

### 1. PDF Export — All Report Types
**3 new PDF composers:**
- `server/reports/pdf-summary.js` — Sales Summary, Product Mix, Employee, Hourly, Station (5 generators in 1 file)
- `server/reports/pdf-transactions.js` — Transaction search results
- `server/reports/pdf-audit.js` — Audit trail with stats summary

**New PDF endpoints:** `GET /summary/pdf`, `/product-mix/pdf`, `/employee/pdf`, `/hourly/pdf`, `/station/pdf` on reports router. `GET /export/pdf` on transactions and audit routers.

**BOH portal:** Export PDF buttons added to Summary, Product Mix, Employee, Hourly, Station, Transactions, and Audit tabs. DSR, Paid Outs, Checkout, and Custom already had them.

### 2. Role-Based Tab Visibility
**Role hierarchy constant** in `terminal/js/core.js`:
```
owner (5) > gm (4) > manager (3) > bartender/server/cashier (2) > barback (1)
```

**Security group-based:** Role level derives from security group name first (Owner, GM, Manager, etc.), fallback to `pos_role` field. Fixes mismatch where staff had `pos_role=bartender` but Owner security group.

**Tab strip filtered:** `getVisibleTabs()` — staff only see own tabs by default. With `tab.view_all` permission, see same-level and below (never above).

**Management views filtered:** View Servers, Closed Checks both use `getVisibleTabs()`.

### 3. New Permission Keys
| Key | Purpose | Enabled For |
|---|---|---|
| `tab.view_all` | View all tabs from same-level and lower roles | Manager, GM, Owner |
| `mgmt.manage_staff` | Staff management panel access | Manager, GM, Owner |

Both seeded in Supabase `pos_security_permissions` for all 10 security groups (enabled for 3, disabled for 7).

### 4. Staff Management Panel (FOH Terminal)
New MANAGE STAFF section in management nav (`mgmt.manage_staff` permission):
- Lists all staff at lower role level with clock status
- Shows open tabs count, closed tabs count per staff
- MANAGE button → detail view with:
  - Open tabs list (VIEW button switches to that tab)
  - Closed tabs summary
  - RUN CHECKOUT button
  - CLOCK OUT with declared tips input (only if clocked in + no open tabs)

### 5. Tip Declaration on Checkout
- Added "DECLARE TIPS" section to staff checkout report with cash tips input
- Pre-filled with actual cash tips amount
- Declared tips stored on clock-out entry
- `declared_tips` column added to `pos_clock_entries` (auto-migrated on server start)
- Server clock-out endpoint accepts `declared_tips` parameter

### 6. Close Day Redesign (Terminal)
- **Cash Deposit** panel: shows expected net cash, input for counted cash
- **OVER/SHORT** live display as amount is typed
- **Settle Credit Cards** placeholder (merchant processor not active)
- Manual cash deposit amount flows through to `daily_payouts` in Supabase
- Error messages cleaned — no IP/Supabase/database references

### 7. Close Day from BOH
New Close Day tab in BOH portal with:
- Checklist: staff clocked out, checkouts completed, no open tabs
- Staff still clocked in table with per-staff Checkout/Clock Out/tip declaration
- Day summary (net sales, tax, tips, card/cash, paid outs)
- Cash deposit input with expected amount
- CC settle placeholder
- Close Day button (blocked if staff still clocked in)

### 8. Terminal UI
- **Refresh button** — ivory color, 0.7 opacity (was ash, 0.4)
- **Shutdown button** — red circle, top-right next to refresh, runs `sudo shutdown now`
- **Shutdown endpoint** — `POST /api/terminal/shutdown`

### 9. Owner Portal POS Links Fixed
All 5 POS tab cards now clickable with correct paths:
- Security & Staff → `../boh/index.html`
- Products & Menu → `../boh/index.html#products`
- Audit & Transactions → `../boh/index.html#audit` (was COMING SOON)
- Reports & P&L → `../boh/index.html#reports` (was broken path)
- Configuration → `../boh/index.html#config`

BOH portal now supports hash routing via `enterPortal()`.

---

## Files Changed

### riddim-pos (19 files, 3 new)
| File | Change |
|---|---|
| `server/reports/pdf-summary.js` | NEW — 5 PDF generators (summary, product-mix, employee, hourly, station) |
| `server/reports/pdf-transactions.js` | NEW — transaction search PDF |
| `server/reports/pdf-audit.js` | NEW — audit trail PDF with stats |
| `server/routes/reports.js` | +5 PDF endpoints, +3 requires |
| `server/routes/transactions.js` | +GET /export/pdf endpoint |
| `server/routes/audit.js` | +GET /export/pdf endpoint |
| `server/routes/sessions.js` | Manual cash deposit support |
| `server/routes/clock.js` | declared_tips on clock-out |
| `server/index.js` | Shutdown endpoint, declared_tips auto-migration |
| `server/db/schema.sql` | declared_tips column on pos_clock_entries |
| `terminal/js/core.js` | Role hierarchy, SECURITY_GROUPS, getVisibleTabs(), getRoleLevel() |
| `terminal/js/tabs.js` | Tab strip uses getVisibleTabs() |
| `terminal/js/login.js` | mgmt.manage_staff permission gating |
| `terminal/js/management.js` | staff-manage section routing |
| `terminal/js/mgmt-operations.js` | Staff management panel, cash deposit UI, role filtering on servers/checks |
| `terminal/js/clock.js` | Tip declaration on checkout |
| `terminal/js/server-link.js` | serverClockOut() accepts declaredTips |
| `terminal/css/login.css` | Brighter refresh button, red shutdown button |
| `terminal/index.html` | Shutdown button HTML, staff-manage section HTML |

### riddimsupperclub (2 files)
| File | Change |
|---|---|
| `docs/boh/index.html` | PDF export buttons all tabs, Close Day section + staff mgmt, hash routing, new permission keys |
| `docs/owner/index.html` | POS tab links fixed, Audit card active |

---

## Schema Changes

### Local PG (1 column added — auto-migrated)
```sql
ALTER TABLE pos_clock_entries ADD COLUMN IF NOT EXISTS declared_tips numeric(10,2) DEFAULT 0;
```

### Supabase (20 permission rows inserted)
- `tab.view_all` — enabled for Manager, GM, Owner
- `mgmt.manage_staff` — enabled for Manager, GM, Owner

---

## New Permanent Constraints (S86)

| # | Constraint |
|---|---|
| 17 | **Role level derives from security group name, not pos_role.** `getRoleLevel()` checks `groupName` (from `pos_security_groups.name`) first, falls back to `pos_role`. Owner group = level 5 regardless of pos_role value. (S86) |
| 18 | **Tab strip is role-filtered.** `getVisibleTabs()` used everywhere — tab strip, View Servers, Closed Checks. Staff only see own tabs unless `tab.view_all` is granted. Never see tabs from higher role level. (S86) |
| 19 | **Cash deposit is manual entry.** Close Day accepts `cash_deposit` from terminal/BOH. Server uses manual amount for `daily_payouts` Cash Deposit row. Expected amount shown for reference. (S86) |

---

## What's Next

> **Resume at commit `6afe9d2` (riddim-pos) / `ae27adb` (riddimsupperclub) on main.**

### Immediate
1. **Stripe Terminal (Phase 3)** — register BBPOS reader, integrate Stripe Terminal SDK for card payments
2. **Supabase DDL** — create `pos_paid_outs_sync` table (SQL provided in S81 briefing)
3. **Populate 8 empty categories** — Signature Drinks, Stock Up, Cordials, VIP Table, Btl Service, Retail, Mixers, Keyboard
4. **Close Day validation** — enforce all staff clocked out + checkouts ran + no open tabs before allowing close (currently advisory only)

### Deferred
5. **KDS (Phase 4)** — kitchen/bar display routing
6. **Inventory Integration (Phase 6)** — sales → theoretical usage via pos_item_id bridge
7. **Fingerprint auth** — U.are.U 4500 + libfprint enrollment
8. **Chrome networking** — ERR_ADDRESS_UNREACHABLE blocking BOH → POS server on Mac
9. **QR scanner** — USB barcode scanner for member check-in / ticket scan
10. **Order persistence** — tabs to Supabase (currently memory + local PG only)
