# RIDDIM POS — Claude Code Project Context
**AG Entertainment | S85 | March 28, 2026**

## What This Project Is
Custom point-of-sale system for RIDDIM Supper Club (Atlanta, GA). Local-first architecture: on-premise server + Elo EloPOS 22" AIO terminals running Ubuntu 22.04 + Chromium kiosk. Integrates with the existing RIDDIM Supabase backend (51 tables — membership, inventory, P&L, events, bookings, ticketing).

**Repo:** `https://github.com/ctrlmanagement/riddim-pos` (PRIVATE)
**Parent project:** `https://github.com/ctrlmanagement/RiddimSupperClub`
**Supabase project:** `cbvryfgrqzdvbqigyrgh` (shared with RIDDIM platform)
**Working directory:** `~/ctrl/riddim-pos`

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CLOUD (Supabase)                   │
│  Members, Events, Menu, Inventory, P&L, Bookings    │
│  51 existing tables + ~11 new POS tables             │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS sync (app-level, 30s)
┌──────────────────────┴──────────────────────────────┐
│         LOCAL SERVER (Elo EloPOS — TERM02)            │
│  Node.js 20 + PostgreSQL 16 + systemd service        │
│  Order engine, tab management, payment processing    │
│  Socket.IO hub for all terminals                     │
│  ESC/POS printer driver (Partner Tech RP-630 USB)    │
└──────┬───────┬───────┬───────┬───────┬──────────────┘
       │       │       │       │       │  LAN (Socket.IO)
    ┌──┴──┐ ┌──┴──┐ ┌──┴──┐ ┌──┴──┐ ┌──┴──┐
    │BAR1 │ │BAR2 │ │BAR3 │ │BAR4 │ │ SVC │  Elo EloPOS 22" AIO
    └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  (Ubuntu + Chromium kiosk)
                       │
                    ┌──┴──┐
                    │ KDS │  Kitchen/Bar display
                    └─────┘
```

## Technology Stack
| Layer | Technology |
|---|---|
| Local Server | Node.js 20 + Express + Socket.IO (systemd service on TERM02) |
| Local Database | PostgreSQL 16 |
| Cloud Database | Supabase PostgreSQL (shared with RIDDIM platform) |
| Sync | Application-level (Node.js daemon, HTTPS to Supabase, 30s cycle) |
| Terminal App | Chromium kiosk on Ubuntu 22.04 (HTML/CSS/JS served by local server) |
| Payment | Stripe Terminal SDK (Phase 3) |
| Printing | ESC/POS via `usb` npm package → Partner Tech RP-630 USB |
| KDS | WebView on tablet, Supabase Realtime (Phase 4) |
| Hardware | Elo EloPOS 22" AIO (terminals), Partner Tech RP-630 (receipt printers), U.are.U 4500 (fingerprint, pending) |

## Deployed Terminals
| Name | IP | Role | Printer | Remote | Status |
|---|---|---|---|---|---|
| TERM02 | 10.77.2.53 | POS server + kiosk | RP-630 (working) | RustDesk + http://10.77.2.53:3000/terminal/ | Live |
| TERM03 | 10.77.2.68 | Kiosk client | RP-630 (needs print agent) | RustDesk | Live |
| MacBook | 10.77.2.70 | Dev only | — | — | Dev |

## Folder Structure
```
riddim-pos/
├── server/           # Node.js local server (order engine, sync, Socket.IO)
│   ├── routes/       # REST API (orders, clock, transactions, audit, reports, sync, paid-outs, sessions, printer)
│   ├── printer/      # ESC/POS driver for Partner Tech RP-630 (escpos.js)
│   ├── reports/      # PDF renderer + composers (DSR, checkout, paid-outs, custom)
│   ├── sync/         # Supabase sync daemon
│   └── sockets/      # Socket.IO terminal events
├── terminal/         # Staff-facing terminal UI (HTML/CSS/JS, Chromium kiosk)
├── kds/              # Kitchen/Bar display system
├── provisioning/     # Ubuntu setup scripts (setup-terminal.sh, setup-server.sh)
├── docs/             # Architecture docs, specs
├── _reference/       # Odoo POS source for study (not deployed)
│   └── odoo-pos/     # addons/point_of_sale + pos_restaurant
└── .claude/agents/   # POS-specific Claude agents
```

## BAR_CONFIG (from RIDDIM — canonical)
```javascript
const BAR_CONFIG = [
  { id:'LR',    label:'Liquor Room', pos:null,    active:true  },
  { id:'BAR1',  label:'Bar 1',       pos:'POS 1', active:true  },
  { id:'BAR2',  label:'Bar 2',       pos:'POS 2', active:true  },
  { id:'BAR3',  label:'Bar 3',       pos:'POS 3', active:true  },
  { id:'BAR4',  label:'Bar 4',       pos:'POS 4', active:true  },
  { id:'BAR5',  label:'SVC',         pos:'POS 7', active:true  },
];
```

## Design System (inherited from RIDDIM)
| Token | Value |
|---|---|
| `--color-obsidian` | `#0A0A0A` |
| `--color-gold-warm` | `#D4A843` |
| `--color-ivory` | `#F5F0E8` |
| `--color-ash` | `#888888` |
| Display font | Cormorant Garamond |
| Label font | Bebas Neue |
| Body font | DM Sans |

## Integration Points (existing RIDDIM tables)
| System | Key Tables | POS Connection |
|---|---|---|
| Inventory | inv_products (has `pos_item_id`), inv_counts, inv_stock_ups | Sales → theoretical usage |
| P&L | daily_payouts (date+label key), pl_revenue | Auto-populate 11 DSR fields |
| Members | members, points_ledger | Lookup at terminal, spend tracking, points |
| Table Bookings | table_bookings, table_sessions | Tab linked to booking, min spend tracking |
| Events | events, tickets | Event menus, ticket scan → tab |
| Staff | staff (inv_staff), scheduling | Clock in/out, server assignment, tips |

## Permanent Constraints
1. **Local-first.** POS must operate with zero internet. Cloud sync is secondary.
2. **BAR_CONFIG is canonical.** Terminal stations derive from it. Never hardcode locations.
3. **Card data never touches our system.** Stripe Terminal handles PCI. Store only PaymentIntent IDs.
4. **daily_payouts date+label key is sacred.** POS writes into existing P&L structure, not a parallel one.
5. **pos_item_id on inv_products is the bridge.** Menu items link to inventory products through this FK.
6. **Same Supabase project.** POS tables live alongside the existing 51 tables in `cbvryfgrqzdvbqigyrgh`.
7. **RIDDIM design system applies.** Obsidian/gold/ivory palette, Bebas Neue labels, DM Sans body.
8. **Deposit is a split payment.** Payment #1 = deposit, #2 = balance. Unused deposit → OTHER INCOME. (S79)
9. **Tab/session not created until first item or reservation seat.** No blank tables in DB. (S79)
10. **Min spend includes tax, no gratuity.** Subtotal + tax determines minimum met. (S79)
11. **tab.reopen_deposit is separate from tab.reopen.** Owner-only by default. (S79)
12. **booking_id stored on pos_orders.** Required for deposit to survive terminal restart. (S79)
13. **Reopen permissions checked live from Supabase.** Not from login-time cache. (S79)
14. **Report tabs gated by permission tier.** DSR/Paid Outs/Custom = `mgmt.view_dsr`, Employee/Checkout = `mgmt.view_employee_reports`, Summary/Product/Hourly/Station = `mgmt.view_sales`. (S82)
15. **Category styling is CSS-only.** The `pos_menu_categories.color` DB column is not used for terminal rendering. Left column (categories) uses gold tint background; right column (items) uses dark background. Speed rail items get gold highlight background. Never read category colors from the database for terminal UI. (S85)
16. **22 categories match HotSauce.** Beer, Vodka, Champ, Rum, Wine, Gin, Cocktails, Tequila, Signature Drinks, Whiskey, Stock Up, Cordials, VIP Table, Cognac, Non Alcoholic, Scotch, Hookah, Btl Service, Food, Retail, Mixers, Keyboard. Do not rename or merge categories without confirming HotSauce parity. (S85)
17. **Role level derives from security group name.** `getRoleLevel()` checks `groupName` (from `pos_security_groups.name`) first, falls back to `pos_role`. Owner group = level 5 regardless of pos_role value. Never use pos_role alone for hierarchy. (S86)
18. **Tab strip is role-filtered.** `getVisibleTabs()` used everywhere — tab strip, View Servers, Closed Checks, Recall Tabs. Staff only see own tabs unless `tab.view_all` is granted. Never show tabs from higher role level. (S86/S87)
20. **Server-side permission enforcement.** `server/middleware/auth.js` provides `requirePermission()` and `requireOwner()`. Applied to void, comp, price override, tip adjust, clear-all, paid-out delete. Looks up staff security group from DB with 60s cache. Falls through gracefully if lookup fails (local-first). (S87)
21. **Void-after-payment blocked.** Server rejects void on orders with `state = 'paid'`. Must reopen first. (S87)
22. **86 list is persisted.** `pos_86_items` table stores 86'd items. Loaded on terminal connect via `request-86-list` socket event. Survives server restart. (S87)
23. **Qty picker via long-press.** Hold menu item 400ms to open qty modal. Single tap still adds 1. Quick-set buttons: 1, 2, 3, 5, 10. (S87)
24. **PIN lockout.** 5 failed attempts → 60s lockout + audit log. Counter resets on successful login. (S87)
25. **Venue name from CONFIG.** `CONFIG.venue_name`, `venue_subtitle`, `venue_city` used in receipt + printer. Loaded from `pos_config` table if present, defaults to RIDDIM/SUPPER CLUB/Atlanta, GA. (S87)
19. **Cash deposit is manual entry.** Close Day accepts `cash_deposit` from terminal/BOH. Server uses manual amount for `daily_payouts` Cash Deposit row. Expected amount shown for reference only. (S86)

## Research Briefs
Located at `~/ctrl/riddimsupperclub/_briefings/pos-system/`:
| File | Domain |
|---|---|
| POS_Core_Engine_Architecture_Brief.md | Order state machine, tabs, kitchen routing |
| Payment_Processing_Hardware_Briefing.md | Stripe Terminal, Sunmi hardware, PCI, tips |
| POS_Local_Server_Architecture_v1.md | Local PG, sync to Supabase, Socket.IO, offline |
| Android_Terminal_KDS_Briefing_v1.md | WebView hybrid, KDS, printing, bar UI |
| POS_Integration_Map_v1.md | Mapping to existing 51 tables, new tables, workflows replaced |

## Build Priority
Start staff-facing (terminal UI), build the middle (server), connect outward (sync + integrations).

Phase 1: Terminal UI — COMPLETE (S74-S76)
Phase 2: Local server — COMPLETE (S78)
Phase 2.5: RIDDIM integration — COMPLETE (S79) — table_sessions, reservations, members, deposits
Phase 3: Payment — Stripe Terminal integration
Phase 4: KDS — kitchen/bar display routing
Phase 5: Sync — COMPLETE (S80) — local PG → Supabase every 30s, 7 data types
Phase 5.5: Paid outs + P&L export — COMPLETE (S81) — paid out recording, day close → daily_payouts, reports, PDF engine
Phase 5.6: Report security gating — COMPLETE (S82) — per-tab permission tiers, mgmt.view_dsr permission key
Phase 5.7: Hardware provisioning — COMPLETE (S83) — Ubuntu 22.04 on Elo terminals, Chromium kiosk, systemd server, receipt printer driver
Phase 6: Integration — inventory, P&L auto-connect (core P&L done, inventory pending)
Phase 6.5: Printing — COMPLETE (S84) — ESC/POS driver, print agent on TERM03, receipt print button, 42-col/80mm format
Phase 6.6: Terminal ops — COMPLETE (S84) — screensaver, deploy pipeline, refresh button, custom confirm modal, clear test data API
Phase 7: Menu/category redesign — COMPLETE (S85) — horizontal category bar → 2-column vertical sidebar (22 categories matching HotSauce), unified 76px grid, CSS-only category styling, speed rail gold highlights, 60 items across 14 populated categories
Phase 7.1: Remote access — COMPLETE (S85) — RustDesk on TERM02 + TERM03, remote terminal UI at http://10.77.2.53:3000/terminal/
Phase 7.2: BOH ops — COMPLETE (S85) — clear POS data button, POS server LAN IP detection
Phase 8: PDF exports — COMPLETE (S86) — all 9 report types + transactions + audit have PDF export, 3 new composers
Phase 8.1: Role permissions — COMPLETE (S86) — role hierarchy (owner>gm>manager>bartender>barback), tab.view_all, mgmt.manage_staff, security group-based levels
Phase 8.2: Staff management — COMPLETE (S86) — MANAGE STAFF panel, tip declaration on checkout, declared_tips column
Phase 8.3: Close Day redesign — COMPLETE (S86) — cash deposit input, OVER/SHORT display, CC settle placeholder, BOH close day, clean error messages
Phase 8.4: Terminal UI — COMPLETE (S86) — shutdown button, brighter refresh, owner portal POS links fixed
Phase 9: Bug sweep — COMPLETE (S87) — 22 bug fixes, XSS hardening, transaction safety, float rounding, double-submit guards
Phase 9.1: Server permissions — COMPLETE (S87) — middleware auth layer, void/comp/price/tip/clear-all gated, void-after-payment blocked
Phase 9.2: Data persistence — COMPLETE (S87) — 86 list DB table, offline item queue (localStorage), deposit surplus audit, cash deposit override audit
Phase 9.3: Design hardening — COMPLETE (S87) — WCAG contrast fixes, font size bumps, cart widened, tip reorder, color-coded toasts, floor plan enlarged, venue name configurable, search in mgmt panels
Phase 9.4: Qty picker — COMPLETE (S87) — long-press menu item opens qty modal with quick-set buttons
Phase 9.5: PIN lockout — COMPLETE (S87) — 5 attempts → 60s lockout + audit log
