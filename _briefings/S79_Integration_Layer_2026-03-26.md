# Session Briefing — S79: RIDDIM Integration Layer
**Date:** March 26, 2026
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`) + RIDDIM Platform (`~/ctrl/riddimsupperclub`)
**Branch:** `main` (both repos)
**Resume:** `4d1253a` (riddim-pos) / `4102a45` (riddimsupperclub)

---

## Session Summary

Built the RIDDIM integration layer — the connection between POS terminal and the existing Supabase platform (table_sessions, table_bookings, members, table_minimums). Deposit-as-split-payment flow, member phone lookup, reservation seating, deferred tab creation, reopen permissions, and tab hydration from local server.

**Starting state:** S78 complete — local server, BOH portal, reports, audit trail. POS terminal and RIDDIM platform operated independently.

**Ending state:** POS terminal creates/closes table_sessions in Supabase, seats reservations with deposit transfer, looks up members by phone, enforces min spend with tax, handles deposit as split payment, hydrates tabs from local PG on restart.

---

## Commits — riddim-pos (12 commits)

| Commit | Description |
|---|---|
| `0174d70` | Add RIDDIM integration layer — live floor plan, reservations, member lookup, min spend |
| `708733f` | Fix member lookup rendering — inline styles for terminal display |
| `48de484` | Apply booking deposit + min spend to tabs from any entry path |
| `4d98174` | Reopen check — owner-only, re-fetches deposit from Supabase |
| `1c4302c` | Reopen permissions — manager+ for normal checks, owner-only for deposit checks |
| `f57bc4c` | Hydrate tabs from local server on terminal startup — orders survive refresh |
| `029d9a4` | Deposit as split payment — auto-apply, balance due, unused → OTHER INCOME |
| `6f8f7c3` | Store booking_id on pos_orders — deposit survives terminal restart |
| `afab2b5` | Fix reopen permissions + prevent duplicate tabs on deposit tables |
| `2dc35b9` | Add tab.reopen_deposit permission + fix hydration on first login |
| `2efb015` | Min spend includes tax, defer tab creation, allow $0 checkout |
| `4d1253a` | Show booking context in cart — event name, guest, deposit amount |

## Commits — riddimsupperclub (1 commit)

| Commit | Description |
|---|---|
| `4102a45` | Add tab.reopen_deposit to BOH security permissions UI |

---

## What Was Built

### 1. Live Floor Plan ↔ table_sessions

- `createTableSession()` — INSERT into Supabase `table_sessions` when POS tab opens on a table
- `closeTableSession()` — UPDATE to `closed` with payment_amount when tab is paid
- Session cleanup on tab void
- 30-second auto-refresh when in tables view
- Deferred tab creation: clicking a table sets `pendingTableNum`, tab/session only created when first item added or reservation seated

### 2. Reservations → POS Seat Flow

- `loadTableData()` fetches confirmed `table_bookings` with table numbers + events (queried separately per constraint #2)
- RESERVATIONS panel in sidebar — guest name, party size, section, event name, min spend, deposit badge, SEAT button
- `seatFromReservation()` — one tap to: create POS tab, create table_session, mark booking as `seated`, transfer min spend + deposit + member linkage
- `tableClick()` auto-routes to `seatFromReservation()` if reservation exists

### 3. Member Lookup

- New `members.js` module — phone-based search using `.ilike('phone', '%digits%')` (constraint #5)
- Debounced search (300ms), shows name, tier badge (Silver/Gold/Obsidian from points), visit count
- MEMBER quick-tab button opens lookup modal
- `lookupMemberById()` for reservation flow
- Cart shows member badge (tier dot + name + points)

### 4. Deposit as Split Payment

- Deposit auto-applied as payment #1, balance requires card/cash/comp
- If tab < deposit: unused portion → OTHER INCOME
- If deposit covers full tab: payment methods hidden, "COVERED BY DEPOSIT"
- Two payment records written to server (deposit + balance)
- Receipt shows: Deposit Applied, Unused Deposit → Other Income, Balance (METHOD)
- `booking_id` stored on `pos_orders` (local PG) so deposit survives terminal restart

### 5. Min Spend Enforcement

- Min spend checked against subtotal + tax (no gratuity) — matches venue policy
- Cart shows progress bar, payment modal shows shortfall warning
- Receipt shows Min Spend: $X (MET/NOT MET)
- Booking-level `minimum_spend_required` transfers from `table_bookings`

### 6. Reopen Permissions

- `tab.reopen` — controls who can reopen any closed check (security group permission)
- `tab.reopen_deposit` — separate permission for checks with booking deposits (Owner only by default)
- Permissions checked live from Supabase (not cached at login)
- Reopen re-fetches deposit from Supabase, reopens table_session
- Prevents duplicate tabs: clicking table with closed booking tab prompts reopen

### 7. Tab Hydration

- New server endpoint: `GET /api/orders/today/all` — returns today's orders with lines and payments
- `hydrateTabsFromServer()` loads orders from local PG into in-memory tabs on login
- Direct fetch fallback if Socket.IO not yet connected
- Booking data (deposit, min spend) re-fetched from Supabase for hydrated tabs
- `booking_id` and `session_id` columns added to `pos_orders`

### 8. Booking Context in Cart

- Gold info block at top of cart shows: event name, guest name, member name, deposit amount
- Helps staff identify reservation context before adding items

---

## Schema Changes

### Local PostgreSQL (pos_orders)
```sql
ALTER TABLE pos_orders ADD COLUMN booking_id uuid;
ALTER TABLE pos_orders ADD COLUMN session_id uuid;
```

### Supabase (pos_security_permissions)
- Added `tab.reopen_deposit` permission for all 10 security groups (Owner enabled, rest disabled)

---

## New Permanent Constraints (S79)

| # | Constraint |
|---|---|
| 323 | **Deposit is a split payment.** Payment #1 = deposit (auto-applied), payment #2 = balance (card/cash/comp). Unused deposit → OTHER INCOME. |
| 324 | **Tab/session not created until first item or reservation seat.** Table click sets pendingTableNum only. No blank tables in DB. |
| 325 | **Min spend includes tax, no gratuity.** Subtotal + tax determines if minimum is met. |
| 326 | **tab.reopen_deposit is separate from tab.reopen.** Owner-only by default. Controls who can reopen checks with booking deposits. |
| 327 | **booking_id stored on pos_orders (local PG).** Required for deposit to survive terminal restart. |
| 328 | **Reopen permissions checked live.** Not from login-time cache. Supabase queried at execution time. |

---

## What's Next

> **Resume at commit `4d1253a` (riddim-pos) / `4102a45` (riddimsupperclub) on main.**

### Immediate
1. **Fresh booking test** — create new table booking with deposit, test full flow (seat → items → deposit payment → receipt)
2. **KDS (Phase 4)** — kitchen/bar display. Socket.IO events exist, pos_kds_routes table ready.
3. **Supabase sync (Phase 5)** — local PG orders → Supabase for remote BOH access

### Deferred
4. **Stripe Terminal (Phase 3)** — card reader integration
5. **P&L Integration (Phase 6)** — auto-write daily_payouts at day close
6. **Inventory Integration (Phase 6)** — sales → theoretical usage
7. **QR scanner integration** — Ambir DB100 or similar USB HID scanner for TBK:/TKT:/VIP: codes
