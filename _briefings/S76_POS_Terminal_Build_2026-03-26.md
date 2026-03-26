# Session Briefing — S76: RIDDIM POS Terminal Build
**Date:** March 26, 2026
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`)
**Branch:** `main`
**Commits this session:** `a062e86` → `9f2000d` (5 commits)

---

## Session Summary

Built the full front-of-house terminal feature set in a single session. Started with the 31-table floor plan, then swept through all remaining Hot Door reference features: 86 list, edit check (comp/discount/gratuity), clock in/out, seat numbers, FOH reports, manager options, bottle service, receipt preview, and staff checkout. Also created 3 Claude agents for the project.

**Starting state:** Terminal had login, tabs, menu grid, cart, fire/pay/hold/void, Supabase wiring, and management panel (menu CRUD, staff PINs, categories, stations, settings, close day).

**Ending state:** Fully featured FOH terminal matching and exceeding the Hot Door POS reference screenshots.

---

## What Was Built (this session)

### Commit `a062e86` — Tables / Floor Plan View
- Interactive SVG floor plan with all 31 RIDDIM tables (5 sections)
- 3 visual states: available (dark), occupied (gold), reserved (blue)
- $ badges showing running tab totals on occupied tables
- Sidebar: Total/Seated/Reserved/Open stats, Create Tab, Recall Tabs, Fast Bar
- Tables view is now the default landing screen after PIN login
- Nav flow: Login → TABLES → click table or Fast Bar → TERMINAL → MANAGEMENT
- Pulls live data from `table_sessions` + `table_bookings` in Supabase

### Commit `9fbb4a0` — 7 Features + 3 Agents
**Features:**
1. **86 List** — toggle items out of stock, greyed in menu grid, red "86" badge in top bar
2. **Edit Check** — comp item, discount (% or flat $), auto-gratuity (18-25%), edit tab name
3. **Clock In/Out** — PIN-based from login screen, shift duration tracking
4. **Seat Numbers** — seat selector bar (ALL, 1-8), lines tagged per seat, grouped in cart
5. **FOH Reports** — 5 views: Summary (9 KPI cards), Product Mix, Employee, Hourly, Station
6. **Manager Options** — View Servers (tabs by staff), Closed Checks (reopen + change tip)
7. **Bottle Service** — guest count +/-, min spend progress bar from `table_minimums`

**Agents created:**
- `.claude/agents/pos-foh-builder.md` — terminal feature builder with full stack context + 10 build rules
- `.claude/agents/foh-code-reviewer.md` — 7-category code review checklist
- `.claude/agents/riddim-design.md` — complete RIDDIM design system spec

### Commit `bc17026` — Receipt Preview
- Thermal-style receipt modal after every payment close
- RIDDIM branding (Cormorant Garamond), server/station/date/time, itemized lines with seat tags
- Subtotal, discount, tax, gratuity, tip, total, configurable footer from `pos_config`

### Commit `e507a14` — Staff Clock Management View
- Staff Clock panel in Management sidebar
- Clocked In / Not Clocked In tables with green/grey status dots
- Clock-in time, running hours worked, role
- Manager force-clock-out button

### Commit `9f2000d` — Void/Comp Reasons + Staff Checkout
- **Void with reason**: modal with dropdown (Wrong Item, Customer Refused, Spill, Quality Issue, Duplicate, Manager Override, Other) + optional note. Applies to line voids and full tab voids
- **Comp with reason**: reason step (VIP, Manager Discretion, Quality Issue, Wrong Item, Promo, Staff Meal, Other) + optional note
- **Staff Checkout Report**: Daily Checkout matching Hot Door PDF format — net sales summary, payment summary (card/cash/comp × sales+tips), category sales, item summary, tabs closed, cash due, net CC tips
- **Clock-out gate**: open tabs block clock-out; checkout report must be reviewed + confirmed before clock-out completes

---

## Current File Structure

```
terminal/
├── index.html          665 lines  — all screens, modals, nav
├── css/terminal.css   2131 lines  — full design system + all feature styles
└── js/
    ├── app.js          979 lines  — core: login, tabs, cart, fire, pay, receipt, void
    ├── tables.js       300 lines  — floor plan, table click, recall tabs, fast bar
    ├── features.js     656 lines  — 86 list, edit check, clock in/out, seats, bottle svc, checkout
    └── management.js  1122 lines  — view switching, menu/cat/staff/station CRUD, reports, servers, clock, checks, settings, day close
                       ────
                       5853 total
```

---

## Feature Completion vs Hot Door Reference

| Feature | Status |
|---|---|
| PIN login + station selector | Done |
| Floor plan / table map (31 tables) | Done |
| Tab strip + create tab | Done |
| Category bar + menu grid | Done |
| Cart + line items with seat tags | Done |
| Fire (send to KDS) | Done |
| Payment modal (card/cash/comp/split + tip) | Done |
| Receipt preview | Done |
| Hold / Void tab (with reason) | Done |
| 86 list | Done |
| Edit check (comp w/ reason, discount, gratuity, rename) | Done |
| Bottle service (min spend, guest count) | Done |
| Guest/seat numbers | Done |
| Clock in/out (with checkout gate) | Done |
| Staff checkout report (Daily Checkout) | Done |
| FOH reports (5 types) | Done |
| Manager: view servers | Done |
| Manager: staff clock | Done |
| Manager: closed checks (reopen + change tip) | Done |
| Management: menu/category/staff/station CRUD | Done |
| Management: POS settings | Done |
| Management: close day | Done |
| Recall tabs | Done |
| Fast bar | Done |
| Card scan to open tab | Not yet — needs Stripe Terminal SDK |
| Table management (reservations, transfer balance) | Not yet — partial via Supabase table_sessions |

---

## What's Next (suggested)

1. **Local server** (Phase 2 per CLAUDE.md) — Node.js + Express + Socket.IO + local PostgreSQL. Order engine, multi-terminal sync, offline persistence
2. **KDS** (Phase 4) — Kitchen/bar display system, item routing by category
3. **Stripe Terminal integration** (Phase 3) — card reader on Sunmi T3, PaymentIntent flow
4. **Supabase sync** (Phase 5) — local PG ↔ Supabase bidirectional for orders, P&L
5. **Integration** (Phase 6) — inventory deductions, daily_payouts P&L write, membership points

---

## Reference Material

- **Hot Door screenshots:** `Screen/` directory (27 PNGs from current HotSauce POS)
- **Hot Door checkout PDF:** `Screen/check out.pdf` (2-page Daily Checkout template)
- **Research briefs:** `~/ctrl/riddimsupperclub/_briefings/pos-system/` (5 architecture briefs)
- **RIDDIM staff portal floor plan:** `~/ctrl/riddimsupperclub/docs/staff/index.html` (line 208-259, SVG source)
- **Supabase schema snapshot:** `~/ctrl/riddimsupperclub/_reference/schema_snapshot_pre_pos_2026-03-25.csv`
