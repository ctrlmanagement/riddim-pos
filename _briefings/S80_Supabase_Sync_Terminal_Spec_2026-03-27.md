# Session Briefing — S80: Supabase Sync + Terminal Hardware Spec
**Date:** March 27, 2026
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`) + RIDDIM Platform (`~/ctrl/riddimsupperclub`)
**Branch:** `main` (both repos)
**Resume:** `7005798` (riddim-pos) / `56e4a0d` (riddimsupperclub)

---

## Session Summary

Built Phase 5 (Supabase sync daemon) and specced out the terminal hardware pivot from Android tablets to Linux all-in-one touchscreens with fingerprint auth. Also redesigned the Owner Portal dashboard to show live POS data and new KPI panels.

**Starting state:** S79 complete — integration layer done, POS data trapped in local PG only.

**Ending state:** Sync daemon pushes local PG → Supabase every 30 seconds. Owner Portal reads live POS sales. Terminal hardware fully specced with Linux kiosk config and fingerprint enrollment.

---

## Commits — riddim-pos (1 commit)

| Commit | Description |
|---|---|
| `7005798` | Phase 5: Supabase sync daemon + terminal hardware spec |

## Commits — riddimsupperclub (4 commits)

| Commit | Description |
|---|---|
| `ccc720a` | Dashboard POS Sales KPI — read from pos_orders_sync instead of DSR imports |
| `0a88cc8` | Move POS Sales to Revenue MTD card, restore Net Sales for DSR/P&L |
| `1459754` | Dashboard redesign — Door Revenue, Year Totals, live POS Net Sales & P&L |
| `1255607` | Revert Month P&L to DSR-only — POS totals are not reconciled P&L revenue |
| `56e4a0d` | Month P&L only shows completed days with DSR data |

---

## What Was Built

### 1. Supabase Sync Daemon (Phase 5)

- **`server/sync/index.js`** — background worker running every 30 seconds
- Syncs 6 data types: orders, order lines, payments, clock entries, audit log, day-close sessions
- Queries local PG for rows where `synced_at IS NULL`, upserts to Supabase, stamps `synced_at`
- Skips on internet failure, retries next cycle — local-first stays intact
- First sync pushed 159 rows with zero errors

**New Supabase tables (mirror):**
- `pos_orders_sync` — member_id as text (matches members table), server_id as text (matches staff table)
- `pos_order_lines_sync` — FK to pos_orders_sync
- `pos_payments_sync` — FK to pos_orders_sync
- `pos_clock_entries_sync` — staff_id as text
- `pos_audit_log_sync` — last 24h upsert (no synced_at on local table)
- `pos_sessions_sync` — day-close session totals

**RLS:** Public read (BOH portal), service_role write (sync daemon only)

**API endpoints:**
- `GET /api/sync/status` — last sync time, pending counts, error count, enabled flag
- `POST /api/sync/trigger` — force immediate sync cycle
- Health check (`/api/health`) now includes sync status

**Server dependencies added:** `@supabase/supabase-js`
**Dual Supabase clients:** `supabase` (publishable key, reads) + `supabaseAdmin` (service role key, writes)

### 2. Terminal Hardware Pivot

**Decision:** Sunmi T3 Pro Max Android tablets → Elo EloPOS 22" Linux all-in-one touchscreens

**Hardware spec (5 stations):**
- Elo EloPOS 22" (Linux, i5, 8GB, 128GB SSD) — $1,350 each
- Digital Persona U.are.U 4500 fingerprint reader — $70 each (6 total, 1 spare)
- Stripe Reader S700 — $349 each
- Epson TM-T88VII receipt printers — $400 each (3 total)
- APC UPS (600VA terminals, 1500VA server)
- Ubiquiti 16-port PoE switch
- Mac Mini M4 server
- **Total: ~$11,749**

**Linux config:**
- Ubuntu 24.04 LTS, Chrome kiosk mode, libfprint for fingerprint
- Two users: `admin` (full desktop, IT only) and `terminal` (auto-login, locked kiosk)
- Firewall: whitelist Mac Mini + Stripe API only
- Boot-to-POS: ~15-20 seconds
- Remote management via SSH from Mac Mini

**Auth change:** 4-digit PIN removed, fingerprint scan only at fixed stations. iPad Mini for SVC uses QR badge scan. Enrollment via MacBook Pro + BOH portal.

**Spec doc:** `docs/Terminal Specs/RIDDIM_POS_Terminal_Spec.md` + PDF

### 3. Owner Portal Dashboard Redesign

**Top KPI row:**
- "Revenue MTD" → renamed "POS Sales" — reads from `pos_orders_sync` (live, works remotely)

**Breakdown panel:**
- "Net Sales" — running monthly from POS subtotals + DSR combined
- "Month P&L" — DSR-only (reconciled numbers), only shows completed days with actual DSR data
- Table Bookings — unchanged
- Inventory Alerts — unchanged

**New bottom panels (replaced Weekly Check-Ins + Tier Distribution):**
- **Door Revenue** — guest list count, free tickets, paid tickets, daily door revenue (from `tickets` table)
- **Year-to-Date Totals** — Revenue YTD, Members enrolled YTD, Events YTD, Tickets sold YTD, Table Bookings YTD

---

## Schema Changes

### Supabase (6 new tables)
```sql
pos_orders_sync, pos_order_lines_sync, pos_payments_sync,
pos_clock_entries_sync, pos_audit_log_sync, pos_sessions_sync
```

### Local PG
No changes — `synced_at` columns already existed from S78.

### Server .env
Added `SUPABASE_SERVICE_KEY` (service role key for sync writes)

---

## New Permanent Constraints (S80)

| # | Constraint |
|---|---|
| 329 | **Sync daemon uses service role key.** Publishable key for reads, service role for writes. Service key never exposed to browser. |
| 330 | **Month P&L is DSR-only.** POS totals are not reconciled P&L revenue. P&L only shows completed days with actual DSR data. |
| 331 | **Terminal hardware is Linux (not Android, not Windows).** Elo EloPOS 22" with Ubuntu 24.04 LTS, Chrome kiosk, libfprint. |
| 332 | **Fingerprint replaces PIN.** U.are.U 4500 at fixed stations, QR badge on iPad, enrollment via BOH portal. |

---

## Hardware Decisions Made

- Elo EloPOS 22" Linux (not Android version at $532 — no fingerprint support)
- Modular compute (Elo Backpack) allows future OS swap
- iPad Mini for SVC table service (QR badge auth, not fingerprint)
- MacBook Pro for fingerprint enrollment (USB U.are.U 4500 + BOH portal)

---

## What's Next

> **Resume at commit `7005798` (riddim-pos) / `56e4a0d` (riddimsupperclub) on main.**

### Immediate
1. **KDS (Phase 4)** — kitchen/bar display. Socket.IO events exist, pos_kds_routes table ready.
2. **Stripe Terminal (Phase 3)** — card reader integration with S700 via JS SDK
3. **Fingerprint auth build** — libfprint agent, enrollment flow, template matching

### Deferred
4. **P&L Integration (Phase 6)** — auto-write daily_payouts at day close
5. **Inventory Integration (Phase 6)** — sales → theoretical usage
6. **QR badge scan** — iPad SVC station auth
7. **Terminal Linux provisioning script** — automate Ubuntu + Chrome kiosk + fingerprint agent setup
