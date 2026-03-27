# Session Briefing — S82: Report Security Gating
**Date:** March 27, 2026
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`) + RIDDIM Platform (`~/ctrl/riddimsupperclub`)
**Branch:** `main` (both repos)
**Resume:** `cd3c875` (riddim-pos) / `d0c45b2` (riddimsupperclub) on main

---

## Session Summary

Added per-tab permission gating to FOH report tabs. Previously the entire Reports section was gated behind `mgmt.view_sales`. Now each report tab requires a specific permission tier: DSR/Paid Outs/Custom require `mgmt.view_dsr` (manager/owner), Employee/Checkout require `mgmt.view_employee_reports` (manager+), and Summary/Product Mix/Hourly/Station remain on `mgmt.view_sales`. Also added `mgmt.view_dsr` as a new permission key (40th) to Supabase security groups and BOH portal.

**Starting state:** S81 complete — paid outs, reports, PDF engine, BOH portal reports all done. All report tabs visible to anyone with `mgmt.view_sales`.

**Ending state:** Report tabs gated by permission tier. `mgmt.view_dsr` permission seeded in Supabase (enabled for Manager, GM, Owner). BOH portal permission matrix updated. `pos_paid_outs_sync` table pending creation in Supabase dashboard (DDL provided).

---

## What Was Built

### 1. Report Tab Permission Gating (terminal)

**`terminal/js/login.js` — `applyPermissionUI()`:**
- Reports nav button now visible if user has ANY of: `mgmt.view_sales`, `mgmt.view_employee_reports`, `mgmt.view_dsr`
- Individual report tab buttons hidden/shown based on permission tier
- Auto-selects first visible tab as active on login

**`terminal/js/mgmt-reports.js` — `switchReport()`:**
- Added `REPORT_TAB_PERMS` map with per-tab permission keys
- Permission check before rendering (defense-in-depth against DOM manipulation)

**Permission tier mapping:**
| Tab | Permission Key | Who |
|---|---|---|
| Summary | `mgmt.view_sales` | Bartender+ |
| Product Mix | `mgmt.view_sales` | Bartender+ |
| Hourly | `mgmt.view_sales` | Bartender+ |
| Station | `mgmt.view_sales` | Bartender+ |
| Employee | `mgmt.view_employee_reports` | Manager+ |
| Checkout | `mgmt.view_employee_reports` | Manager+ |
| DSR | `mgmt.view_dsr` | Manager/GM/Owner |
| Paid Outs | `mgmt.view_dsr` | Manager/GM/Owner |
| Custom | `mgmt.view_dsr` | Manager/GM/Owner |

### 2. New Permission Key — `mgmt.view_dsr`

- 40th permission key (was 39)
- Added to all 7+ security groups in Supabase
- Enabled for: Manager, GM, Owner
- Disabled for: Bartender, Riddim Bartender, Cashier, Barback, Hostess, Kitchen, Waitress
- Added to BOH portal `PERM_CATEGORIES` array (`riddimsupperclub/docs/boh/index.html`)

### 3. Supabase — Pending DDL

`pos_paid_outs_sync` table DDL was provided but requires manual creation in Supabase SQL Editor (REST API cannot run DDL). SQL includes RLS policies for public read + service_role write.

---

## Files Changed

### riddim-pos
| File | Change |
|---|---|
| `terminal/js/login.js` | `applyPermissionUI()` — report tab gating + reports nav OR-logic |
| `terminal/js/mgmt-reports.js` | `REPORT_TAB_PERMS` map + permission check in `switchReport()` |

### riddimsupperclub
| File | Change |
|---|---|
| `docs/boh/index.html` | Added `mgmt.view_dsr` to PERM_CATEGORIES management section |

---

## What's Next

> **Resume at commit `cd3c875` (riddim-pos) / `d0c45b2` (riddimsupperclub) on main.**

### Immediate
1. **Supabase DDL** — create `pos_paid_outs_sync` table (SQL provided in S81/S82 briefings)

### Deferred
2. **KDS (Phase 4)** — kitchen/bar display routing
3. **Stripe Terminal (Phase 3)** — card reader integration with S700
4. **Fingerprint auth build** — libfprint agent, enrollment flow for Elo EloPOS + U.are.U 4500
5. **Thermal printer receipts** — ESC/POS for checkout slips, paid out receipts on terminal
6. **Inventory Integration (Phase 6)** — sales → theoretical usage via pos_item_id bridge
7. **P&L field refinement** — daily_payouts field mapping review with owner
