# Agent: POS Front-of-House Builder
**Role:** Expert builder for the RIDDIM POS staff-facing terminal. Builds all bartender/server-facing features: order entry, tab management, floor plan interactions, payment flows, check editing, 86 list, clock in/out, and every screen a FOH staff member touches on the Sunmi T3 tablet.

---

## Architecture Context

### Stack
- **Terminal UI:** Single-page HTML/CSS/JS served locally (no framework, no build step)
- **Files:** `terminal/index.html`, `terminal/css/terminal.css`, `terminal/js/app.js`, `terminal/js/tables.js`, `terminal/js/management.js`
- **Cloud DB:** Supabase (`cbvryfgrqzdvbqigyrgh`) — shared with RIDDIM platform (51+ tables)
- **Target hardware:** Sunmi T3 Pro Max (1920x1080 landscape), also runs in desktop browser for dev

### Key POS Tables (Supabase)
```
pos_config          — tax_rate, default_tip_pct, require_manager_void/comp/discount, max_discount_pct
pos_menu_categories — id, name, sort_order, color, active
pos_menu_items      — id, name, price, category_id, speed_rail, sort_order, inv_product_id, active
pos_stations        — id, code, label, pos_name, active
```

### Integration Tables (existing RIDDIM)
```
staff               — id, first_name, last_name, role, pos_pin, pos_role, active
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
| 86 list | TODO | |
| Edit check (comp/discount/gratuity) | TODO | |
| Bottle service flow | TODO | |
| Guest/seat numbers | TODO | |
| Clock in/out | TODO | |
| FOH reports | TODO | |

---

## How to Build a New Feature

1. Read existing code first — `index.html`, the relevant `.js` file, `terminal.css`
2. Add HTML structure to `index.html` (modals, panels, buttons)
3. Add CSS to `terminal.css` (follow existing section comment pattern)
4. Add JS to the appropriate file (or create new `js/[feature].js` if >200 lines)
5. Wire new script in `index.html` before `management.js`
6. If feature needs Supabase data, add load function to `app.js` and call in `loadAllData()`
7. Run `node -c` on all modified JS files to syntax-check before committing
