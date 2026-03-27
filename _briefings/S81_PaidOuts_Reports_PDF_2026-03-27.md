# Session Briefing — S81: Paid Outs, Reports, PDF Engine
**Date:** March 27, 2026
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`) + RIDDIM Platform (`~/ctrl/riddimsupperclub`)
**Branch:** `main` (both repos)
**Resume:** `e35a419` (riddim-pos) / `d0c45b2` (riddimsupperclub)

---

## Session Summary

Built the paid out recording flow, P&L export at day close, 3 new report types (DSR, Server Checkout, Paid Out Summary), a PDF generation engine, a custom report builder with presets, and ported all reports to the BOH Owner portal. Also fixed sync daemon re-pushing rows every cycle.

**Starting state:** S80 complete — sync daemon running, terminal hardware specced, no paid outs, no P&L integration, no DSR.

**Ending state:** Full paid out flow on terminal, day close writes to Supabase daily_payouts (11 DSR fields + expense rows), 4 new report tabs on terminal + BOH portal, branded PDF export engine, custom report builder with saved presets.

---

## Commits — riddim-pos (3 commits)

| Commit | Description |
|---|---|
| `116a41c` | Paid outs, P&L export, reports + PDF engine, custom report builder |
| `e35a419` | Fix sync daemon re-pushing same rows every cycle |

## Commits — riddimsupperclub (1 commit)

| Commit | Description |
|---|---|
| `d0c45b2` | BOH reports: DSR, Checkout, Paid Outs, Custom builder + PDF export |

---

## What Was Built

### 1. Paid Out Path (Terminal → Server → Local PG)

**Flow (matches HotSauce):**
1. Day Close screen → `+ PAID OUT` button
2. Step 1: Numpad amount entry ($0.00 format)
3. Step 2: Category picker (21 categories mapped to daily_payouts labels)
4. Step 3: Notes entry + confirmation → submit

**21 categories → daily_payouts label mapping:**
- Security/Security #2 → Security Co. #1/#2
- Police → Apd
- Shift Pay/Shift Pay #2 → Bar Shift Pay #1/#2
- Barbacks → Barbacks
- Sweeps → Sweeper
- Hookah Staff → Hookah
- Incidentals/Supplies → Bar Supplies
- Cashier → Cashier
- DJ Opening/Closing → DJ #1 (opening)/DJ #2 (closing)
- Promoters → Promoters
- Cleaning → Cleaners
- Host Table → Hostess
- Table Percentage → Tbl Line
- Manager/Manager #2 → Manager 1/Manager 2
- Kitchen → Kitchen
- VIP Host/Photo → Misc #1/Misc #2

**New table:** `pos_paid_outs` (local PG) — category, amount, notes, staff_id, staff_name, station_code, session_id, synced_at

**New routes:** `POST/GET/DELETE /api/paid-outs`, `GET /api/paid-outs/categories`

### 2. P&L Export (Day Close → daily_payouts)

`POST /api/sessions/close` aggregates all POS data for the business day:
- 11 DSR rows (Net Sales, Sales Taxes, Emp Tips Payable, POS Bar Cash/CC, Comp Total, Table Service Fees, etc.)
- Collection rows (CC Bar 1/2, CC SVC, Cash Deposit)
- Expense rows from paid outs (category → daily_payouts label)
- Upserts to Supabase `daily_payouts` on `(date, label)` composite key

`closeDay()` on terminal now calls this endpoint, shows sync status, audit logs the close.

### 3. Reports (3 new types)

**DSR (Daily Summary Report):**
- Sales summary (gross, discounts, comps, net, tax, service fees, gross revenue)
- Payment summary (card/cash/comp with counts, sales, tips)
- Expenditures (paid outs by category)
- Cash reconciliation (gross cash, less tips, less paid outs, net cash retained, cash deposit)
- Comp summary by reason
- Void summary by reason

**Server Checkout:**
- Staff picker → per-server shift report
- Clock in/out, hours worked
- Sales breakdown, payment breakdown
- Cash due, CC tips owed
- Items sold

**Paid Out Summary:**
- Grouped by category with individual line items (amount, notes, staff, time)
- Category subtotals, grand total

### 4. PDF Generation Engine

**`server/reports/pdf-renderer.js`** — shared branded template:
- White background (print-first), gold accent headers, ivory section fills
- Alternating row fills, page numbers, confidential footer
- Primitives: `sectionHeader()`, `tableHeader()`, `tableRow()`, `kvRow()`, `spacer()`

**Type-specific composers:** `pdf-dsr.js`, `pdf-checkout.js`, `pdf-paid-outs.js`, `pdf-custom.js`

**Endpoints:** `GET /api/reports/dsr/pdf`, `GET /api/reports/checkout/:staffId/pdf`, `GET /api/reports/paid-out-summary/pdf`, `POST /api/reports/custom` (format=pdf)

**New dependency:** `pdfkit` added to server/package.json

### 5. Custom Report Builder

13 toggleable sections: Sales Summary, Payment Breakdown, Cash Reconciliation, Paid Outs, Comp Summary, Void Summary, Employee Sales, Employee Tips, Hourly Sales, Station Sales, Product Mix, Clock In/Out Log, Top 10 Items.

- Saved presets (localStorage)
- Date range picker
- Preview before export
- PDF export with selected sections only

### 6. BOH Portal Reports

Added 4 new tabs to BOH portal (`docs/boh/index.html`):
- DSR — full daily summary with PDF export
- Checkout — staff picker → per-server report with PDF export
- Paid Outs — grouped by category with PDF export
- Custom — section picker, presets, preview, PDF export

Owner Portal POS page: "Reports & P&L" card now active (links to BOH).

### 7. Sync Daemon Fix

Order lines and payments queries had no dedup guard — re-pushed same rows every 30s cycle. Fixed: both now only sync for orders synced within the last 2 minutes.

### 8. Report PDF Agent

`.claude/agents/pos-report-pdf.md` — specialized agent for PDF report generation. Knows RIDDIM design system, all endpoints, section architecture, 10 key rules.

---

## Schema Changes

### Local PG (1 new table)
```sql
pos_paid_outs (id, session_id, category, amount, notes, staff_id, staff_name, station_code, recorded_at, synced_at, created_at)
```

### Supabase (needs creation)
```sql
pos_paid_outs_sync — mirror of pos_paid_outs, RLS: public read, service_role write
```

---

## New Permanent Constraints (S81)

| # | Constraint |
|---|---|
| 333 | **Paid out categories map to daily_payouts labels.** 21 categories → 23 expense labels. Mapping lives in `server/routes/paid-outs.js` PAIDOUT_CATEGORIES array. |
| 334 | **Reports are BOH features, not FOH.** DSR/P&L/custom reports belong in Owner BOH portal. Terminal exports = thermal printer, not PDF. PDF export is a BOH/owner feature. |
| 335 | **All PDFs use the shared renderer.** Never build one-off PDF layouts. Use `pdf-renderer.js` primitives. Numbers in PDFs must match JSON endpoints. |

---

## Key Feedback Captured

- **Reports belong in BOH, not terminal.** DSR/P&L/custom reports are Owner/BOH features. Terminal output should be thermal printer receipts (checkout slips, paid out receipts), not PDF downloads. Terminal can keep basic summary views for managers.

---

## What's Next

> **Completed in S82.** Report security gating and `mgmt.view_dsr` permission done. See `S82_Report_Security_Gating_2026-03-27.md`.
