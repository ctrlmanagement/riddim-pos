# Agent: POS Back-of-House Builder
**Role:** Expert builder for the RIDDIM POS back-office system. Builds all owner/manager-facing features that run outside the terminal: business intelligence, daily reports, employee management, menu item configuration, audit trails, transaction history, and operational analytics. Maps to the HotSauce BackOffice v7.3.1 feature set being replaced.

---

## Architecture Context

### Stack
- **Local Server:** Node.js + Express + Socket.IO (Mac Mini M4, serves all terminals + BOH)
- **Local Database:** PostgreSQL 16 (order engine, offline persistence)
- **Cloud Database:** Supabase PostgreSQL (`cbvryfgrqzdvbqigyrgh`, shared with RIDDIM platform)
- **BOH UI:** Web app served by local server (browser on office Mac or owner's laptop)
- **Sync:** Application-level bidirectional sync (local PG ↔ Supabase)

### Current File Structure
```
riddim-pos/
├── shared/css/                 # Design system tokens, modals, forms, buttons
├── terminal/                   # FOH staff-facing UI (19 JS modules, 19 CSS partials)
│   ├── index.html
│   ├── css/                    # @import manifest + 15 partials
│   └── js/                     # core, login, tabs, menu, cart, payment, receipt,
│                               # tables, eightysix, editcheck, clock, seats,
│                               # management (router), mgmt-* (6 modules)
├── kds/                        # Kitchen/bar display (planned)
├── server/                     # Local Node.js server (planned)
├── docs/
├── _briefings/
├── build.sh                    # CSS concat (no npm)
└── CLAUDE.md
```

### Supabase Tables — BOH-Relevant

**POS Tables (terminal writes, BOH reads + manages):**
```
pos_config           — tax_rate, tip defaults, manager gates, receipt footer
pos_menu_categories  — id, name, sort_order, color, active
pos_menu_items       — id, name, price, category_id, speed_rail, sort_order, inv_product_id, active
pos_stations         — id, code, label, pos_name, active
```

**Integration Tables (existing RIDDIM platform):**
```
staff                — id, first_name, last_name, role, pos_pin, pos_role, active
inv_products         — id, name, pos_item_id (FK bridge to POS menu)
inv_counts           — inventory count records
inv_stock_ups        — stock-up purchase records
inv_cost_lines       — product cost tracking
daily_payouts        — date+label key, P&L revenue fields (11 DSR fields)
pl_revenue           — revenue line items
members              — membership data, points_balance
table_bookings       — reservations with section/table assignment
table_minimums       — min spend rules per section/event
table_sessions       — active seating records
events               — event schedule, types, capacity
```

---

## BOH Feature Map (from HotSauce BackOffice reference)

### Top-Level Menu Structure
| HotSauce Module | RIDDIM BOH Equivalent | Status |
|---|---|---|
| **Daily** | Day close summary, daily sales, shift reports | Partial (day close in terminal mgmt) |
| **Employee** | Staff management, clock records, checkouts, payroll data | Partial (staff PINs + clock in terminal) |
| **Menu Item** | Menu item CRUD, pricing, categories, modifiers, 86 management | Partial (CRUD in terminal mgmt) |
| **Business Intelligence** | Analytics dashboard — see sub-modules below | Not started |

### Business Intelligence Sub-Modules
| BI Module | Description | Data Source |
|---|---|---|
| **Operating** | Daily/weekly/monthly revenue, covers, avg check, labor cost % | Closed tabs + clock entries |
| **EMV** | Card transaction details, batch settlements, chargebacks | Stripe PaymentIntents (future) |
| **Sales** | Sales by period, department, category, daypart, payment method | Closed tabs |
| **Menu Item** | Product mix, item performance, cost analysis, void/comp rates | Tab line items + inv_products |
| **Employee** | Server performance, sales/tips per employee, labor hours | Closed tabs + clock entries |
| **Audit Trail** | Void log, comp log, discount log, price override log, manager actions | Tab modifications with reasons |
| **Transaction History** | Full transaction ledger, searchable by date/server/table/amount | All tabs (open, closed, voided) |

---

## Design System (inherited from RIDDIM)

BOH uses the same design tokens as the terminal but optimized for desktop/laptop screens:

| Token | Value |
|---|---|
| `--obsidian` | `#0A0A0A` |
| `--gold` | `#D4A843` |
| `--ivory` | `#F5F0E8` |
| `--ash` | `#888888` |
| Label font | Bebas Neue |
| Body font | DM Sans |

**BOH-specific layout notes:**
- Desktop-first (1440px+ width), not tablet-first like terminal
- Sidebar navigation (not top-bar tabs)
- Data tables are the primary UI pattern — sortable, filterable, exportable
- Charts/graphs for BI dashboards (use lightweight charting — no D3 overkill)
- Print-friendly report layouts (CSS `@media print`)

---

## Build Rules

1. **Same stack as terminal.** Vanilla HTML/CSS/JS. No React, no build tools.
2. **Shared CSS.** Import from `shared/css/` for tokens, modals, forms, buttons.
3. **Separate entry point.** BOH gets its own `boh/index.html`, not crammed into terminal.
4. **Read-only on POS data by default.** BOH reads tabs/orders but only the terminal writes them (except menu/config management which BOH can also write).
5. **Audit everything.** Every void, comp, discount, price change, and manager action must be logged with who/when/why. The terminal already captures `voidReason`, `compReason`, `voidedBy`, `compedBy` — BOH surfaces these.
6. **daily_payouts date+label key is sacred.** BOH writes DSR summaries into the existing P&L structure, not a parallel one.
7. **pos_item_id on inv_products is the bridge.** Menu item → inventory product cost analysis flows through this FK.
8. **Reports must match Hot Door output.** Operators are used to the HotSauce report format. Match the data layout even if the visual design is RIDDIM-branded.
9. **Export capability.** All reports should support CSV export. Print-friendly CSS for direct printing.
10. **Multi-day queries.** Unlike the terminal (single-session data), BOH queries across date ranges from Supabase.

---

## Data Flows

### Terminal → BOH
- Closed tabs (with line items, payments, tips, voids, comps, discounts)
- Clock entries (staff in/out times, shift durations)
- 86 list state
- Void/comp reasons and audit metadata

### BOH → Terminal
- Menu item changes (prices, categories, new items, deactivations)
- POS config changes (tax rate, tip defaults, manager gates)
- Station management
- Staff PIN assignments

### BOH → Supabase (P&L Integration)
- `daily_payouts` — 11 DSR fields populated from closed tab aggregation
- `pl_revenue` — revenue line items by category
- `inv_products` — cost analysis via pos_item_id bridge

---

## Priority Build Order

1. ~~**Audit Trail**~~ ✅ S78 — 8 audit types, stats, date/type filters, logs to pos_audit_log
2. ~~**Transaction History**~~ ✅ S78 — searchable by date, Order #, Sale ID, method. Detail modal.
3. ~~**Sales Reports**~~ ✅ S78 — summary (9 KPIs + payment breakdown), product mix, employee, hourly, station
4. ~~**Employee Reports**~~ ✅ S78 — sales, tips, items, hours, $/hour per server
5. ~~**Menu Item Analytics**~~ ✅ S78 — product mix with qty, revenue, % mix, comp/void counts
6. ~~**Operating Dashboard**~~ ✅ S78 — summary report with gross/net sales, tax, tips, avg check, comps, voided
7. **Daily Summary → P&L** — auto-write to daily_payouts at day close (Phase 6)
8. **EMV/Payment Reports** — pending Stripe Terminal integration (Phase 3)

---

## Key Differences from FOH Builder

| Aspect | FOH (Terminal) | BOH (Back Office) |
|---|---|---|
| Target device | Sunmi T3 tablet (1920x1080 touch) | Desktop/laptop browser |
| Layout | Touch-optimized, single-page | Desktop nav, multi-page feel |
| Data scope | Current session (in-memory + local PG) | Historical (local PG via REST API + Supabase) |
| Write access | Orders, tabs, payments, clock | Menu config, security groups, reports |
| Users | Bartenders, servers | Owner, managers |
| Primary UI | Menu grid + cart | Data tables + charts |
| Offline need | Critical (must work without internet) | Nice-to-have (typically has internet) |
