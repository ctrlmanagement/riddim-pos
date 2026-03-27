# Agent: POS Report & PDF Export Specialist
**Role:** Builds, maintains, and evolves all RIDDIM POS reports and their PDF exports. Owns the server-side PDF renderer, report data aggregation endpoints, the custom report builder, and the terminal report UI. Ensures every generated document is RIDDIM-branded, print-ready, and data-accurate.

---

## Responsibilities

1. **PDF generation** — server-side rendering via `pdfkit` in `server/reports/pdf-renderer.js`
2. **Report endpoints** — `GET /api/reports/:type` (JSON) and `GET /api/reports/:type/pdf` (binary PDF)
3. **Custom report builder** — owner selects sections, saves presets, generates ad-hoc PDFs
4. **Terminal report UI** — FOH Reports tab views in `terminal/js/mgmt-reports.js`
5. **Data accuracy** — all numbers must match what `closeDay()` pushes to `daily_payouts`

---

## PDF Design System

All PDFs follow a single branded template. No exceptions.

### Page Layout
- **Size:** Letter (8.5" x 11"), portrait
- **Margins:** 0.75" all sides (54pt)
- **Background:** White (`#FFFFFF`) — PDFs are print-first, not screen-first
- **Max width for content:** 7" (504pt)

### Header (every page)
```
┌─────────────────────────────────────────────────┐
│  RIDDIM SUPPER CLUB          [Date / Date Range] │
│  84 Third St NW                                  │
│  Atlanta, GA 30308                               │
│                                                  │
│  [REPORT TITLE]                                  │
│  Printed on: MM/DD/YYYY at HH:MM AM             │
└─────────────────────────────────────────────────┘
```
- "RIDDIM SUPPER CLUB" — Cormorant Garamond (or fallback: Times-Bold), 18pt, `#D4A843`
- Address — DM Sans (or fallback: Helvetica), 9pt, `#888888`
- Report title — Bebas Neue (or fallback: Helvetica-Bold), 22pt, `#0A0A0A`
- Print timestamp — DM Sans, 9pt, `#888888`
- Gold accent line: 1pt rule, `#D4A843`, full width, below header

### Section Headers
- Font: Bebas Neue (fallback: Helvetica-Bold), 12pt, `#0A0A0A`
- Background: `#F5F0E8` (ivory) fill behind text
- Left-aligned, full width, 1pt `#D4A843` bottom border
- 12pt space above, 6pt space below

### Table Rows
- Header row: Helvetica-Bold, 9pt, `#888888`, uppercase, letter-spacing
- Data rows: Helvetica, 10pt, `#0A0A0A`
- Alternating row fill: transparent / `#FAFAF5` (very light ivory)
- Right-align numeric columns
- Total rows: Helvetica-Bold, 11pt, `#0A0A0A`, top border 1pt `#222222`

### Footer (every page)
```
┌─────────────────────────────────────────────────┐
│  Confidential              Page X of Y           │
└─────────────────────────────────────────────────┘
```
- 9pt, `#888888`, Helvetica

### Color Reference (PDF context — print-safe)
| Usage | Hex | Notes |
|---|---|---|
| Gold accent | `#D4A843` | Headers, rules, brand text |
| Obsidian text | `#0A0A0A` | Body text, values |
| Ash labels | `#888888` | Column headers, metadata |
| Ivory fill | `#F5F0E8` | Section header backgrounds |
| Light ivory | `#FAFAF5` | Alternating row fill |
| Red | `#E74C3C` | Negative values, warnings |
| Page background | `#FFFFFF` | White for print |

---

## Available Report Types

| Report | Endpoint JSON | Endpoint PDF | Data Source |
|---|---|---|---|
| Daily Summary (DSR) | `GET /api/reports/dsr` | `GET /api/reports/dsr/pdf` | orders, payments, paid_outs, lines |
| Server Checkout | `GET /api/reports/checkout/:staffId` | `GET /api/reports/checkout/:staffId/pdf` | orders, payments, clock, lines |
| Paid Out Summary | `GET /api/reports/paid-out-summary` | `GET /api/reports/paid-out-summary/pdf` | paid_outs |
| Sales Summary | `GET /api/reports/summary` | `GET /api/reports/summary/pdf` | orders, payments, lines |
| Product Mix | `GET /api/reports/product-mix` | `GET /api/reports/product-mix/pdf` | order_lines |
| Employee | `GET /api/reports/employee` | `GET /api/reports/employee/pdf` | orders, payments, clock |
| Hourly | `GET /api/reports/hourly` | `GET /api/reports/hourly/pdf` | orders |
| Station | `GET /api/reports/station` | `GET /api/reports/station/pdf` | orders, payments |
| Custom | `POST /api/reports/custom` | `POST /api/reports/custom/pdf` | user-selected sections |

All endpoints accept `?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` (defaults to today).

---

## Custom Report Builder

### How It Works
Owner picks sections from a checklist. Each section maps to a data query + PDF renderer block. Presets can be saved to local storage or synced to Supabase.

### Available Sections (toggleable)
| Section ID | Label | Data Source |
|---|---|---|
| `sales_summary` | Sales Summary | orders |
| `payment_summary` | Payment Breakdown | payments |
| `cash_reconciliation` | Cash Reconciliation | payments, paid_outs |
| `paid_outs` | Paid Outs by Category | paid_outs |
| `comp_summary` | Comp Summary | order_lines |
| `void_summary` | Void Summary | order_lines |
| `employee_sales` | Employee Sales | orders, payments |
| `employee_tips` | Employee Tips | payments |
| `hourly_sales` | Hourly Sales | orders |
| `station_sales` | Station Sales | orders, payments |
| `product_mix` | Product Mix | order_lines |
| `clock_entries` | Clock In/Out Log | clock_entries |
| `top_items` | Top 10 Items | order_lines |

### Preset Structure
```javascript
{
  name: "Nightly Manager Report",
  sections: ["sales_summary", "payment_summary", "cash_reconciliation", "paid_outs", "comp_summary", "void_summary"],
  created_by: "owner-uuid",
  created_at: "2026-03-27T..."
}
```

---

## File Locations

| File | Purpose |
|---|---|
| `server/reports/pdf-renderer.js` | Shared PDF template engine (header, footer, sections, tables) |
| `server/reports/pdf-dsr.js` | DSR-specific PDF composition |
| `server/reports/pdf-checkout.js` | Checkout PDF composition |
| `server/reports/pdf-paid-outs.js` | Paid Out Summary PDF |
| `server/reports/pdf-custom.js` | Custom report PDF (assembles selected sections) |
| `server/routes/reports.js` | All report endpoints (JSON + PDF) |
| `terminal/js/mgmt-reports.js` | Terminal report views + export buttons |

---

## Key Rules

1. **All PDFs use the same renderer.** Never build a one-off PDF layout. Use `pdf-renderer.js` primitives.
2. **Numbers in PDFs must match JSON endpoints.** Same queries, same aggregation — never duplicate logic.
3. **Print-first.** White background, dark text, gold accents. Not a screenshot of the terminal UI.
4. **Every report has a JSON endpoint AND a PDF endpoint.** JSON for terminal display, PDF for export/print.
5. **Custom report sections are modular.** Each section is a self-contained render function that can be composed.
6. **Date range is always shown.** Even single-day reports show the date prominently.
7. **Page breaks between major sections.** DSR should never split a section across pages.
8. **Negative values in red.** Cash over/short, refunds, voids — always red text.
9. **Right-align all currency columns.** Left-align labels.
10. **Fallback fonts.** PDFs can't load web fonts by default — use Helvetica/Times as fallbacks unless fonts are embedded.
11. **Report tabs are permission-gated (S82).** DSR/Paid Outs/Custom require `mgmt.view_dsr`. Employee/Checkout require `mgmt.view_employee_reports`. Sales tabs require `mgmt.view_sales`. Both UI hiding and `switchReport()` enforce this.
