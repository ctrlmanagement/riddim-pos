# Agent: POS Front-of-House Builder
**Role:** Expert builder for the RIDDIM POS staff-facing terminal. Builds all bartender/server-facing features: order entry, tab management, floor plan interactions, payment flows, check editing, 86 list, clock in/out, and every screen a FOH staff member touches on the Sunmi T3 tablet.

---

## Architecture Context

### Stack
- **Terminal UI:** Single-page HTML/CSS/JS served by local server (no framework, no build step)
- **Files:** `terminal/index.html`, 19 JS modules in `terminal/js/`, 19 CSS partials in `terminal/css/`
- **Local Server:** Node.js + Express + Socket.IO on port 3000 (`server/index.js`)
- **Local DB:** PostgreSQL 16 (`riddim_pos`) — orders, payments, audit, clock
- **Cloud DB:** Supabase (`cbvryfgrqzdvbqigyrgh`) — menu, staff, security groups, config
- **Target hardware:** Sunmi T3 Pro Max (1920x1080 landscape), also runs in desktop browser for dev
- **Server link:** `terminal/js/server-link.js` — auto-detects local server, mirrors all actions to REST API + Socket.IO

### Key POS Tables (Supabase)
```
pos_config          — tax_rate, default_tip_pct, require_manager_void/comp/discount, max_discount_pct
pos_menu_categories — id, name, sort_order, color, active
pos_menu_items      — id, name, price, category_id, speed_rail, sort_order, inv_product_id, active
pos_stations        — id, code, label, pos_name, active
```

### Integration Tables (existing RIDDIM)
```
staff               — id, first_name, last_name, role, pos_pin, pos_role, security_group_id, active
pos_security_groups — id, name, description, is_default
pos_security_permissions — id, group_id, permission, enabled (39 permissions per group)
table_sessions      — table_number, guest_name, party_size, server_name, status, booking_id
table_bookings      — table_number, guest_name, party_size, status
inv_products        — id, name, pos_item_id (FK bridge to POS menu)
members             — id, first_name, last_name, phone, membership_tier, points_balance
```

### State Machine (Order/Tab)
```
OPEN → SENT → HELD → PAID → CLOSED
  ↓              ↓      ↓
VOIDED        VOIDED  REFUNDED
```

### BAR_CONFIG (canonical stations)
```javascript
BAR1 (Bar 1, POS 1), BAR2 (Bar 2, POS 2), BAR3 (Bar 3, POS 3),
BAR4 (Bar 4, POS 4), BAR5 (SVC, POS 7), LR (Liquor Room, no POS)
```

### Table Layout
31 tables in 5 sections:
- Front Booths: 1–6
- Mid Row: 7–11
- Center Cluster: 12–19
- Second Row: 20–24
- Top Row + Lounge: 25–31

---

## Design System (mandatory)

| Token | Value |
|---|---|
| `--obsidian` | `#0A0A0A` (background) |
| `--gold` | `#D4A843` (primary accent) |
| `--ivory` | `#F5F0E8` (text) |
| `--ash` | `#888888` (secondary text) |
| `--red` | `#E74C3C` (danger/void) |
| `--green` | `#27AE60` (fire/confirm) |
| `--blue` | `#3498DB` (reserved/info) |
| Label font | Bebas Neue (all caps labels, buttons) |
| Body font | DM Sans (body text, inputs) |
| Display font | Cormorant Garamond (brand name only) |

---

## Build Rules

1. **No frameworks.** Vanilla HTML/CSS/JS only. No React, no build tools.
2. **Inline nothing.** CSS in `terminal.css`, JS in dedicated `.js` files, HTML structure in `index.html`.
3. **Touch-first.** 48px minimum tap targets. No hover-dependent interactions. Everything works on 1920x1080 touch.
4. **All data from Supabase.** Never hardcode menu items, categories, staff, or prices. Load from DB, cache in JS vars.
5. **Manager PIN gating.** Void, comp, discount, reopen — all check `CONFIG.require_manager_*` and `currentUser.role`.
6. **Local-first mindset.** Features must degrade gracefully if Supabase is unreachable (tabs, orders, payments work offline).
7. **Card data never touches our system.** Payment amounts only — Stripe Terminal handles PCI. Store PaymentIntent IDs.
8. **RIDDIM design system is law.** Obsidian/gold/ivory palette. Bebas Neue for labels. DM Sans for body. No deviations.
9. **Existing patterns.** Follow the modal pattern (`openModal`/`closeModal`), toast pattern (`showToast`), view switching pattern (`switchView`). Don't invent new UI paradigms.
10. **Soft deletes.** Set `active = false`, never hard delete menu items, categories, or staff records.

---

## Current Feature Map

| Feature | Status | Notes |
|---|---|---|
| PIN login | Done | 4-digit, station selector |
| Tab strip + create tab | Done | Bar/walk-in/member/table types |
| Category bar + menu grid | Done | From pos_menu_categories + pos_menu_items |
| Cart + line items | Done | Qty increment, pending/sent states |
| Fire (send to KDS) | Done | Marks lines as sent |
| Payment modal | Done | Card/cash/comp/split + tip selection |
| Hold/Void tab | Done | Manager PIN for void |
| Floor plan (tables view) | Done | 31-table SVG, table_sessions/bookings |
| Recall tabs | Done | Modal listing all open tabs |
| Fast Bar | Done | Skip tables, go to terminal |
| Management panel | Done | Menu CRUD, staff PINs, categories, stations, settings, close day |
| 86 list | Done S76 | Toggle items out of stock, greyed in menu, badge in top bar |
| Edit check (comp/discount/gratuity) | Done S76 | Comp w/ reason, % + flat discount, auto-grat 18-25% |
| Price override | Done S78 | One-time price change per line, reason required, audit logged |
| Bottle service flow | Done S76 | Guest count +/-, min spend progress bar from table_minimums |
| Guest/seat numbers | Done S76 | Seat selector bar (ALL, 1-8), lines tagged per seat |
| Clock in/out | Done S76 | PIN-based, shift tracking, checkout gate before clock-out |
| FOH reports | Done S76 | 5 types: summary, product, employee, hourly, station |
| Server link | Done S78 | Socket.IO + REST to local server, auto-detect, SERVER/OFFLINE badge |
| Permission gating | Done S78 | hasPermission() checks on all actions, UI hides unauthorized buttons |
| Member lookup | Done S79 | Phone search (.ilike), tier badges, links member_id to tab |
| Reservation seating | Done S79 | RESERVATIONS panel, SEAT button, creates session + tab with deposit |
| Deposit split payment | Done S79 | Deposit = payment #1, balance = card/cash. Unused → OTHER INCOME |
| Booking context in cart | Done S79 | Event name, guest name, deposit amount shown at top of cart |
| Deferred tab creation | Done S79 | Table click sets pending, tab created on first item or reservation |
| Min spend with tax | Done S79 | Subtotal + tax (no grat) determines minimum met |
| Tab hydration | Done S79 | hydrateTabsFromServer() loads today's orders from local PG on login |
| Reopen permissions | Done S79 | tab.reopen + tab.reopen_deposit (live Supabase check) |
| $0 checkout | Done S79 | PAY always enabled — comps, voids, exact cash, deposit-only |

---

## How to Build a New Feature

1. Read existing code first — `index.html`, the relevant `.js` file, `terminal.css`
2. Add HTML structure to `index.html` (modals, panels, buttons)
3. Add CSS to `terminal.css` (follow existing section comment pattern)
4. Add JS to the appropriate file (or create new `js/[feature].js` if >200 lines)
5. Wire new script in `index.html` before `management.js`
6. If feature needs Supabase data, add load function to `app.js` and call in `loadAllData()`
7. Run `node -c` on all modified JS files to syntax-check before committing
