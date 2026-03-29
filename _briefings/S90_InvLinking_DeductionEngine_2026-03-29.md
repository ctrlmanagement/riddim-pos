# Session 90 — Inventory Linking + Deduction Engine
**Date:** March 29, 2026

## Shipped This Session

### P0a — Menu Item inv_product_id Linking (migration 006)
- **102 menu items** linked to `inv_products` via `inv_product_id` foreign key
- **10 new SKUs inserted** into `inv_products`:
  - Jose Cuervo Tradicional Reposado (well tequila)
  - Four Roses Yellow Label (well whiskey)
  - Goslings Black Seal Rum
  - Hennessy Paradis
  - Remy Martin Louis XIII
  - Don Julio Ultima Reserva
  - Clase Azul Ultra
  - WhistlePig 18
  - Blue Moon
  - Casamigos Anejo
- **Riddim Punch** recipe created (Goslings Black Seal base)
- **Well spirits confirmed:** Vodka=Titos, Rum=Bacardi Superior, Gin=Tanqueray, Tequila=Jose Cuervo Tradicional Reposado, Whiskey=Four Roses Yellow Label
- **13 items intentionally NULL** (food, hookah, zero-proof) — no inventory deduction

### P0b — Modifier inv_product_id Linking (migration 007)
- New `inv_product_id` column on `pos_modifiers` table
- **12 spirit upgrade modifiers** linked to their `inv_products` row
- Enables deduction engine to track upgrade spirit usage (not house spirit)

### P0c — Terminal Spirit Modifier Swap
- When spirit upgrade modifier selected, order line `inv_product_id` swaps from house spirit to upgrade spirit
- `core.js` loads `inv_product_id` on modifiers at startup
- `modifiers.js` passes `spiritInvProductId` through cart
- **Priority chain:** modifier inv_product_id > menu item default inv_product_id > null
- Example: Cosmo + Grey Goose modifier -> line.inv_product_id = Grey Goose (not Titos)

### P1 — Theoretical Usage Deduction Engine (migration 008 + sessions.js)
- **New table:** `pos_theoretical_usage` in Supabase
- **Triggered at day close:** aggregates all non-voided order lines by `inv_product_id` + station
- **Pour calculation:** qty x `std_pour_oz` (2oz default)
- **Bottle detection:** items ending " (Btl)" counted as whole bottles
- **Stock Up excluded:** already tracked in `inv_stock_ups`
- **Comps included:** spirit was consumed regardless of charge
- **UPSERTs** to Supabase (idempotent on re-close)
- Close response includes `theoretical_usage` field

### POS Variance View (owner portal — owner_inv.js)
- **New sub-tab** in owner portal Cost tab
- Queries `pos_theoretical_usage` for last 7 days
- Compares POS theoretical usage against physical count usage from finalized cost periods
- **Columns:** Pours, POS oz, Bottles, POS Total, Physical, Variance, Var %
- **15% threshold** flags items in red
- **KPIs:** Total Pours, Bottles Sold, Products Tracked, Flagged
- **CSV export** included

### BOH Menu Management (mgmt-menu.js + management.js + index.html)
- `inv_product_id` dropdown added to add/edit item modal
- Grouped by category with `<optgroup>` elements
- `subcategory` field added to add/edit item modal
- Menu table shows **INV SKU** column (linked product name or "UNLINKED" in red)
- `management.js` preloads `inv_products` for dropdown population
- No more raw SQL needed to link new menu items to inventory

## Migrations Run
| # | File | What |
|---|------|------|
| 6 | 006_inv_product_linking.sql | inv_product_id FK on pos_menu_items, 10 new SKUs, 102 items linked |
| 7 | 007_modifier_inv_linking.sql | inv_product_id column on pos_modifiers, 12 spirit upgrades linked |
| 8 | 008_theoretical_usage_table.sql | pos_theoretical_usage table + RLS |

## Single-SKU Architecture (Completed This Session)

**One Grey Goose row in `inv_products`** -> four ring-up paths:

| Path | Staff action | Inventory impact | inv_product_id linked? |
|---|---|---|---|
| VODKA -> Grey Goose | Pour (2oz) | Usage deduction | YES |
| BTL SVC -> Grey Goose | Bottle sale ($300) | Full bottle deduction | YES |
| STOCK UP -> Grey Goose | Request from LR | Transfer LR -> bar | YES |
| Cosmo + Spirit: Grey Goose | Upcharged pour (2oz) | Deducts Grey Goose | **YES** |

All four paths now carry `inv_product_id` through to `pos_theoretical_usage`.

## Full Inventory Pipeline (Wired End-to-End)

```
POS Sale (terminal)
    |
    v
pos_order_lines.inv_product_id  (set at ring-up, swapped by modifier)
    |
    v
Day Close (sessions.js)
    |
    v
pos_theoretical_usage  (aggregated by product + station + date)
    |
    v
Owner Portal - POS Variance view  (owner_inv.js)
    |
    v
Compare: theoretical usage vs physical count usage
    |
    v
Variance flags at 15% threshold
```

## Next Session Priorities

### P0 — Product Costs + PAR Levels
- Set cost-per-unit on new Bar Builders products (10 new SKUs)
- PAR levels for bar stations

### P1 — KDS (Phase 4)
- Kitchen/bar display system
- WebView on tablet, Supabase Realtime

### P2 — Stripe Terminal (Phase 3)
- Card payment integration
- PCI-compliant via Stripe Terminal SDK

### P3 — Other
- LR printer for Stock Up request tickets
- POS Close Day -> P&L integration improvements

## Files Changed (Full Session)

### riddim-pos
| File | Change |
|------|--------|
| terminal/js/core.js | Loads inv_product_id on modifiers at startup |
| terminal/js/modifiers.js | Spirit swap logic — passes spiritInvProductId through cart |
| terminal/js/mgmt-menu.js | inv_product_id dropdown, subcategory field, INV SKU column |
| terminal/js/management.js | Preloads inv_products for menu management dropdown |
| terminal/index.html | New form fields for inv_product_id + subcategory in add/edit modal |
| server/routes/sessions.js | Theoretical usage deduction engine at day close |
| _reference/migrations/006_inv_product_linking.sql | Menu item inv_product_id FK + 10 SKUs + 102 links |
| _reference/migrations/007_modifier_inv_linking.sql | Modifier inv_product_id column + 12 spirit links |
| _reference/migrations/008_theoretical_usage_table.sql | pos_theoretical_usage table |

### riddimsupperclub
| File | Change |
|------|--------|
| docs/owner/owner_inv.js | POS Variance sub-tab in Cost tab |
