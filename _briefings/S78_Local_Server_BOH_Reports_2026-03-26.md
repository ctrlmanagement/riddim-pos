# Session Briefing — S78: Local Server, BOH Portal, Reports
**Date:** March 26, 2026
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`) + RIDDIM Platform (`~/ctrl/riddimsupperclub`)
**Branch:** `main` (both repos)
**Backup tag:** `pre-reports-s77` (both repos, prior to reports build)

---

## Session Summary

Continuation of S77. Built the local server (Phase 2), wired the terminal to persist orders to PostgreSQL, completed all 7 BOH portal sections, added full audit trail with price override and tip adjustment gating, built 5 report types, and connected live POS sales to the Owner Dashboard.

**Starting state:** S77 complete — security groups in Supabase, BOH portal scaffold with security + staff pages, `hasPermission()` wired into terminal.

**Ending state:** Full end-to-end POS system: terminal → local server → PostgreSQL → BOH portal reports. Multi-terminal sync via Socket.IO. Owner Dashboard shows live POS sales.

---

## Commits — riddim-pos (9 commits)

| Commit | Description |
|---|---|
| `ee5e6fa` | Wire `hasPermission()` into FOH terminal — security groups control all access |
| `b3f42ec` | Add local server — Express + Socket.IO + PostgreSQL order engine (6 tables) |
| `575d137` | Wire terminal to local server — orders persist to PostgreSQL |
| `56955f9` | Add Order # + Sale ID to receipts, transaction search API, CORS |
| `9f3b0fb` | Wire GitHub Pages terminal to detect and connect to local POS server |
| `20ec585` | Add audit trail API — void/comp/discount logs with stats |
| `5796d1b` | Add price override, tip gate (35% rule), full audit trail (8 types) |
| `907a02e` | Add reports API — summary, product mix, employee, hourly, station |
| `22955a8` | S77 session briefing |

## Commits — riddimsupperclub (9 commits)

| Commit | Description |
|---|---|
| `7f60e87` | Add BOH portal + POS tab in Owner Portal Finance section |
| `84197c0` | Add Products + Config pages to BOH portal |
| `521c43e` | Add Transaction Lookup to BOH portal |
| `1270e86` | Update security auditor with S77 POS decisions (constraints 10-13) |
| `002615e` | Add Audit Trail to BOH portal |
| `8f18cdc` | Expand BOH audit — discounts, price changes, tip adjustments, 86, reopens |
| `cce44d3` | Add Reports page to BOH portal — 5 report types |
| `ba17475` | Add live POS sales to Owner Dashboard KPIs |
| `e99e24e` | Fix live POS sales overlay timing |

---

## What Was Built

### 1. Local Server (Phase 2)

```
server/
├── index.js              # Express + Socket.IO + CORS + static serving
├── .env                  # DATABASE_URL, SUPABASE_URL, PORT
├── package.json          # express, socket.io, pg, dotenv
├── db/
│   ├── schema.sql        # 7 tables + 2 sequences
│   └── pool.js           # pg Pool connection
├── routes/
│   ├── orders.js         # Full order lifecycle REST API
│   ├── clock.js          # Clock in/out
│   ├── transactions.js   # Transaction search with filters
│   ├── audit.js          # Audit trail + stats + log entry
│   └── reports.js        # 5 report endpoints
└── sockets/
    └── terminal.js       # Socket.IO events for multi-terminal sync
```

**Local PostgreSQL tables (7):**
- `pos_orders` — 6-state machine + order_num sequence
- `pos_order_lines` — line states + original_price for overrides
- `pos_payments` — card/cash/comp + sale_num sequence + tip
- `pos_clock_entries` — clock in/out with force-out tracking
- `pos_sessions` — day close summaries
- `pos_kds_routes` — category → KDS station routing
- `pos_audit_log` — discount, price override, tip adjust, 86 toggle, tab reopen

**REST API (20+ endpoints):**
- Orders: create, add lines, fire, hold, void (line + tab), comp, pay, price override, tip adjust
- Clock: in, out (with force-out)
- Transactions: search by date/order#/sale ID/method, detail view
- Audit: search by type/date, stats summary, log new entry
- Reports: summary, product mix, employee, hourly, station

### 2. Terminal ↔ Server Wiring

- `server-link.js` — new module: Socket.IO connection, REST API helpers, auto-detects server at localhost:3000
- Socket.IO client loads from local server or CDN fallback
- Every action mirrors to server: create tab, add lines, fire, void, comp, pay, hold, clock, 86
- SERVER/OFFLINE badge in top-right corner
- Works from both `localhost:3000/terminal/` and GitHub Pages (when server is reachable)
- Orders get sequential Order # and Sale ID on receipts

### 3. BOH Portal — All 7 Sections Complete

```
portal.ctrlmanagement.com/boh/
├── Security      — group CRUD, 39-permission checkbox matrix
├── Staff         — employee list, security group assignment, PIN management
├── Products      — menu item CRUD, categories, search + filter
├── Config        — tax/tips/discount settings, manager gates, stations
├── Audit         — 8 audit types, 6 stat cards, date/type filters
├── Transactions  — search by date/order#/sale ID/method, detail modal
└── Reports       — 5 report types with date range
```

**BOH connects to local POS server** (localhost:3000) for transactions, audit, and reports. Shows CONNECTED/OFFLINE badge. Falls back gracefully.

### 4. Audit Trail (8 types)

| Type | Trigger | Gate |
|---|---|---|
| Void (line) | Void sent item | `order.void_line` |
| Void (tab) | Void entire tab | `order.void_tab` |
| Comp | Comp item | `order.comp` |
| Discount | Apply % or flat $ | `order.discount` |
| Price override | Change line item price | `order.modify` + reason required |
| Tip adjustment | Change tip on closed check | Over 35% base → `pay.change_tip` |
| 86 toggle | Mark item in/out of stock | `floor.86_toggle` |
| Tab reopen | Reopen closed check | Logged |

### 5. Owner Dashboard — Live POS Sales

Revenue MTD and Net Sales KPIs now show live POS data when local server is running. Green "+$X POS today" label. Runs after P&L data loads so it overlays correctly.

### 6. Security Decisions (added to security-auditor.md)

- **Constraint 10:** BOH portal has no Google OAuth redirect URI — access only through Owner Portal link
- **Constraint 11:** Security groups are sole authority for terminal access, no pos_role fallback
- **Constraint 12:** Card data never touches our system — Stripe PaymentIntent IDs only
- **Constraint 13:** Local POS server has no auth on REST API (LAN-only acceptable)

---

## Current Architecture

```
┌─────────────────────────────────────────────┐
│            CLOUD (Supabase)                  │
│  Members, Menu, Staff, Security Groups,      │
│  Inventory, P&L, Events, Bookings            │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
┌──────────────────┴──────────────────────────┐
│     portal.ctrlmanagement.com                │
│  Owner Portal ─┬─ BOH Portal (queries both) │
│                │   Supabase + localhost:3000  │
└────────────────┴─────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│         LOCAL SERVER (Mac Mini M4)           │
│  Node.js + Express + Socket.IO               │
│  PostgreSQL 16 (orders, payments, audit)     │
│  Port 3000 — LAN only                       │
└──┬───────┬───────┬───────┬──────────────────┘
   │       │       │       │  Socket.IO (LAN)
┌──┴──┐ ┌──┴──┐ ┌──┴──┐ ┌──┴──┐
│BAR1 │ │BAR2 │ │BAR3 │ │BAR4 │  Terminals
└─────┘ └─────┘ └─────┘ └─────┘
```

---

## What's Next

> **Resume at commit `907a02e` (riddim-pos) / `e99e24e` (riddimsupperclub) on main.**
> **Backup tag: `pre-reports-s77`**

### Immediate
1. **KDS (Phase 4)** — Kitchen/bar display. Data is in local PG, Socket.IO events exist. Need `kds/index.html` + KDS route subscriptions.
2. **Supabase sync (Phase 5)** — Bidirectional: local PG orders → Supabase for BOH remote access. Supabase menu/staff → local PG cache.
3. **Strip terminal management CRUD** — Products and Config now live in BOH. Terminal management panel should simplify to read-only or remove duplicated CRUD.

### Deferred
4. **Stripe Terminal (Phase 3)** — Card reader integration. Considering Stripe chip readers + Stripe Link for online. Discuss after local server stabilizes.
5. **P&L Integration (Phase 6)** — Auto-write daily_payouts at day close from POS session data.
6. **Inventory Integration (Phase 6)** — Sales → theoretical usage via pos_item_id bridge.

---

## Reference Material

- **HotSauce BOH screenshots:** `Screen/boh/` (BackOffice v7.3.1)
- **HotSauce FOH screenshots:** `Screen/` (27 PNGs)
- **HotSauce Transaction Manager:** `Screen/boh/` (search by date/Sale ID/Order ID/method)
- **Research briefs:** `~/ctrl/riddimsupperclub/_briefings/pos-system/` (5 briefs)
- **Schema snapshot:** `~/ctrl/riddimsupperclub/_reference/schema_snapshot_pre_pos_2026-03-25.csv`
- **S76 briefing:** `_briefings/S76_POS_Terminal_Build_2026-03-26.md` (FOH terminal)
- **S77 briefing:** `_briefings/S77_BOH_Portal_Security_2026-03-26.md` (security system + BOH scaffold)
