# RIDDIM POS — Claude Code Project Context
**AG Entertainment | S91 | March 29, 2026**

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
| Cloud Database | Supabase PostgreSQL (shared with RIDDIM platform; pos_theoretical_usage table added S90) |
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
| Inventory | inv_products (has `pos_item_id`), inv_counts, inv_stock_ups, pos_theoretical_usage | inv_product_id linked on 102 menu items + 12 modifiers. Theoretical usage written at day close (S90) |
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
19. **Cash deposit is manual entry.** Close Day accepts `cash_deposit` from terminal/BOH. Server uses manual amount for `daily_payouts` Cash Deposit row. (S86)
26. **Blind drop.** Close Day (FOH + BOH) does not show sales totals, expected cash, or pre-fill deposit amount. Staff count cash blind. OVER/SHORT calculated server-side after submission for audit log only. (S88)
27. **Modifiers are denormalized on order lines.** `pos_order_lines.modifiers` is a jsonb array of modifier name strings (e.g. `["Neat","Don Julio 1942 (+$12)"]`). This keeps lines self-contained for offline/receipts. Do not normalize to a join table. (S89)
28. **Spirit upgrade upcharges add to line price.** When a modifier has `price > 0`, the upcharge is added to `pos_order_lines.price` at cart time. The base menu item price is not modified. (S89)
29. **Subcategory headers in menu grid.** When items in a category have `subcategory` set, `renderMenu()` groups them with headers. Only applies to non-search views. (S89)
30. **Recipe data is read-only on terminal.** `pos_menu_items.recipe` jsonb is displayed via the recipe viewer modal. Terminal never writes to it. Management CRUD is a future phase. (S89)
31. **Stock Up is an inventory transfer, not a sale.** STOCK UP category renders `inv_products` (bar-related) at $0.00. Fire writes to `inv_stock_ups` (LR → bartender's station). Lines prefixed "SU:" are excluded from sales reporting. No revenue, tax, or tip impact. (S89)
32. **BTL SVC renders from inv_products, not pos_menu_items.** Uses `bottle_price` column (nullable). NULL = MARKET (owner/GM only can ring). Same inv_products source as Stock Up. One SKU, one record. (S89)
33. **Standard pour is 2oz.** `inv_products.std_pour_oz` default is 2. All existing products updated from 1.25 to 2. (S89)
34. **inv_product_id is set on pos_menu_items at creation.** BOH menu management modal includes Inventory SKU dropdown. All new spirit pour items must have inv_product_id linked. 102 items linked in migration 006. (S90)
35. **Spirit modifier swap priority.** When spirit upgrade modifier has inv_product_id, it overrides the menu item's default: spiritInvProductId > item.invProductId > null. This ensures inventory deducts the upgrade spirit, not the house. (S90)
36. **Theoretical usage at day close only.** pos_theoretical_usage is written by POST /api/sessions/close, not at fire time. Comped items included (spirit consumed). Voided excluded. Stock-up lines (SU:) excluded. (S90)
37. **Well spirits are canonical.** Well Vodka=Titos, Well Rum=Bacardi Superior, Well Gin=Tanqueray, Well Tequila=Jose Cuervo Tradicional Reposado, Well Whiskey=Four Roses Yellow Label. Cocktails using generic "bourbon/vodka/gin/rum/tequila" deduct from these. (S90)
38. **Spirit upgrades are dynamic, not static modifiers.** The "Spirit" modifier group is deactivated. Spirit upgrades come from `pos_menu_items` filtered by the cocktail's `base_spirit_category_id`. Upcharge formula: `max(0, spirit_pour_price - cocktail_price + 2)`. A Manhattan ($16) upgraded to WhistlePig ($25) = $11 upcharge. Set via BOH Management > Edit Item > BASE SPIRIT dropdown. (S91)

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
Phase 9.6: Blind drop + Close Day fix — COMPLETE (S88) — UUID fix for BOH close, removed sales summary from FOH+BOH, blind cash deposit entry, post-close success state
Phase 10: Bar Builders Phase 2 — COMPLETE (S89) — modifier system (5 groups, 31 options, upcharges), 77 new menu items, subcategory grouping, recipe viewer, RARE/ALLOCATED category
Phase 10.1: Stock Up — COMPLETE (S89) — inventory request from terminal, loads inv_products, $0 lines, writes inv_stock_ups on fire
Phase 10.2: BOH menu management — PENDING — subcategory/recipe/modifier CRUD in management screen, multi-category item support
Phase 10.3: Inventory linking — COMPLETE (S90) — P0a/P0b/P0c inv_product_id on 102 menu items + 12 modifiers + terminal spirit swap
Phase 10.4: Deduction engine — COMPLETE (S90) — pos_theoretical_usage table, day close aggregation, owner portal POS Variance view
Phase 10.5: BOH menu management enhanced — COMPLETE (S90) — inv_product_id dropdown, subcategory field in add/edit modal
Phase 10.6: Dynamic spirit upgrades — COMPLETE (S91) — context-aware spirit picker (base_spirit_category_id), rolled-up pricing (max(0, spirit-cocktail+2)), 29 cocktails linked
Phase 10.7: P2 QoL — COMPLETE (S91) — recipe editor (BUILD/METHOD/GLASSWARE/GARNISH in add/edit modal), PRODUCTS panel (bottle price/cost/PAR editing), modifier CRUD panel (add/edit/delete groups + options), base spirit category dropdown
