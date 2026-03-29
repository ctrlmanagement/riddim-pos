# S88 — Close Day Fix + Blind Drop Audit
**Date:** 2026-03-28 (late session)
**Session type:** Bug fix + Audit hardening

---

## What Happened

Close Day was returning 500 from BOH portal. Root cause: BOH `currentUser` has no `.id` (UUID), so fallback `'boh-owner'` string was sent to `pos_sessions.closed_by` (uuid column). Fixed server to validate UUID before INSERT.

Then implemented blind drop policy: removed all sales summaries and expected cash amounts from both FOH terminal and BOH portal Close Day screens. Staff must count and enter cash without seeing totals — standard audit practice.

Also added post-close success confirmation in BOH (was just an alert before).

### Commits
1. `936bf1a` — Fix Close Day 500: validate UUID before INSERT into pos_sessions
2. `9d77bed` — Blind drop: remove sales summary and expected cash from FOH Close Day
3. `ee67e32` — BOH Close Day: blind drop + success confirmation (riddimsupperclub repo)

### Files Changed
- `server/routes/sessions.js` — UUID validation for `closed_by`, nil UUID for audit log
- `terminal/js/mgmt-operations.js` — removed sales/tips/cash/net summary, removed expected amount + pre-fill
- `riddimsupperclub/docs/boh/index.html` — removed DAY SUMMARY panel, removed Expected hint, added success state after close

### Issues Found
- `pos_paid_outs_sync` table missing in Supabase (sync daemon logs errors every 30s)
- Dashboard POS revenue ($135) persists after clearing `pos_payments_sync` — likely sourced from another table or a view
- Supabase POS sync tables (`pos_orders_sync`, `pos_payments_sync`, `pos_sessions_sync`) were cleared but dashboard still shows stale number

## New Constraints
- **Constraint 26: Blind drop.** Close Day (FOH + BOH) does not show sales totals, expected cash, or pre-fill deposit amount. Staff count cash blind. OVER/SHORT calculated server-side after submission for audit log only. (S88)

## Next Steps
- Investigate which Supabase table/view feeds the Owner Dashboard "POS Sales" card ($135 residual)
- Create `pos_paid_outs_sync` table in Supabase to stop sync errors
- Stripe Terminal integration (Phase 3)
- KDS build (Phase 4)
