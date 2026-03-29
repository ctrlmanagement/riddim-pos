# Session 89 — Bar Builders Phase 2
**Date:** March 29, 2026

## Shipped This Session

### Modifier System (NEW)
- **Tables:** `pos_modifier_groups` (5 groups), `pos_modifiers` (31 options) — loaded at terminal startup
- **Groups:** Ice (5), Mix (5), Garnish (5), Prep (4), Spirit (12 with upcharges)
- **Upcharges:** Spirit upgrade group carries price deltas ($4–$12). Upcharge added to line item price.
- **Terminal flow:** Tap drink → modifier picker modal → select options → ADD/SKIP → cart
- **Persistence:** `modifiers` jsonb column on `pos_order_lines` + `pos_order_lines_sync`
- **Display:** Cart shows modifiers as italic text. Receipt HTML + ESC/POS thermal print show modifiers below line item.

### Menu Items Populated (77 new items, 137 total → 115 after BTL SVC cleanup)
- **15 Signature Drinks** (10 originals + 5 batched) — `SIGNATURE DRINKS` category
- **15 Classic Cocktails** — `COCKTAILS` category
- **4 Zero Proof** — `NON ALCOHOLIC` category
- **10 Rare/Allocated** — new `RARE/ALLOCATED` category (#23) + dual-listed in spirit categories
- **~~22 Btl Service~~** — DELETED from pos_menu_items. BTL SVC now renders from inv_products.
- **8 Fast Keys** marked `speed_rail = true`

### Subcategory Tab View
- `subcategory` column on `pos_menu_items`
- Categories with 2+ subcategories render a horizontal tab strip (same as Stock Up)
- Menu grid groups items under subcategory tabs when present

### Recipe Viewer
- `recipe` jsonb column on `pos_menu_items` (specs, method, glassware, garnish, shelfLife)
- 34 cocktails have full recipes (10 signatures, 5 batched, 15 classics, 4 zero proof)
- Gold **i** button on menu items with recipes → tap opens recipe card modal
- Batched drinks show shelf life

### Stock Up (NEW)
- Bartender taps STOCK UP → loads `inv_products` (bar-related categories)
- Category tab strip → subcategory headers → products at $0.00 (REQ)
- Tap product → `SU:` prefixed line at $0.00 on tab
- FIRE → writes to `inv_stock_ups` (LR → bartender's station code)
- No sales/tax/tip impact

### BTL SVC Refactored (inv_products source)
- BTL SVC and Stock Up now share the same `inv_products` data source
- `bottle_price` column added to `inv_products` (nullable = MARKET)
- MARKET items gated to owner/GM (role level 4+) — prompts for price at ring-up
- Known bottle prices seeded for ~22 products
- 22 duplicate BTL SVC rows deleted from `pos_menu_items`
- **One SKU, one record** — foundational for inventory control

### 2oz Pour Default
- `inv_products.std_pour_oz` default changed from 1.25 to 2
- All existing products updated

## Migrations Run
| # | File | What |
|---|------|------|
| 1 | 001_modifiers.sql | Modifier tables + RLS + seed data (4 groups, 19 options) |
| 2 | 002_menu_items_bar_builders.sql | 77 menu items + Rare/Allocated category + Fast Keys |
| 3 | 003_menu_subcategory_recipes.sql | subcategory + recipe columns, BTL SVC grouping, 34 recipes |
| 4 | 004_modifier_upcharges.sql | price column on modifiers, Spirit upgrade group (12 options) |
| 5 | 005_btl_svc_inv_products.sql | bottle_price on inv_products, 2oz pour, delete BTL SVC dupes |

## Single-SKU Architecture (Established This Session)

**One Grey Goose row in `inv_products`** → four ring-up paths:

| Path | Staff action | Inventory impact | inv_product_id linked? |
|---|---|---|---|
| VODKA → Grey Goose | Pour (2oz) | Usage deduction | YES |
| BTL SVC → Grey Goose | Bottle sale ($300) | Full bottle deduction | YES |
| STOCK UP → Grey Goose | Request from LR | Transfer LR → bar | YES |
| Cosmo + Spirit: Grey Goose | Upcharged pour (2oz) | Should deduct Grey Goose | **NOT YET** |

## Next Session Priorities

### P0 — inv_product_id Linking (Critical for Inventory Control)
Spirit upgrade modifiers need `inv_product_id` so upgraded cocktails deduct from the correct SKU. Without this, a Cosmo upgraded to Grey Goose still deducts from house vodka inventory.

**Build:**
1. Add `inv_product_id` column to `pos_modifiers`
2. When spirit modifier selected, swap the line's `inv_product_id` to the upgrade spirit
3. Seed `inv_product_id` on existing 12 spirit upgrade modifiers
4. Inventory deduction logic recognizes the swapped product

### P1 — BOH Menu Management
| Feature | Detail |
|---------|--------|
| Subcategory management | UI to set/edit subcategory on items |
| Recipe management | UI to add/edit recipes |
| Modifier management | CRUD for modifier groups + options + upcharges |
| bottle_price management | Owner sets BTL SVC prices from management screen |

### P2 — Rename INV to INV CTRL
Owner wants inventory management section renamed to INV CTRL across portals to reflect its control function (usage tracking by bar/bartender → HOUSE totals).

### P3 — Other
- KDS (Phase 4) — kitchen/bar display
- POS Close Day → P&L integration
- Stripe Terminal (Phase 3)
- LR printer for Stock Up request tickets (when remote printers configured)

## Files Changed (Full Session)
| File | Change |
|------|--------|
| CLAUDE.md | 8 new constraints (#27–#33), 3 new phases |
| server/db/schema.sql | Modifier tables + modifiers column on order lines |
| server/db/supabase-schema.sql | modifiers column on sync table |
| server/routes/orders.js | Stores modifiers jsonb on line insert |
| server/sync/index.js | Includes modifiers in Supabase sync |
| server/printer/escpos.js | Prints modifiers on thermal receipt |
| terminal/index.html | Recipe modal + modifier picker modal + script tags |
| terminal/js/core.js | Loads modifier groups + subcategory + recipe at startup |
| terminal/js/modifiers.js | NEW — modifier picker with upcharge support |
| terminal/js/stockup.js | NEW — Stock Up + BTL SVC from inv_products |
| terminal/js/menu.js | Subcategory tabs, recipe viewer, Stock Up/BTL SVC routing |
| terminal/js/cart.js | Displays modifiers in cart, stock-up write on fire |
| terminal/js/receipt.js | Displays modifiers on receipt HTML |
| terminal/js/server-link.js | Sends/reads modifiers on line persistence + hydration |
| terminal/css/modifiers.css | NEW — modifier picker, subcategory headers, recipe card, stock up, BTL SVC styles |
| terminal/css/menu.css | position:relative on .menu-item for recipe button |

## Commits
| Hash | Message |
|------|---------|
| 6e74579 | S89: Bar Builders Phase 2 — modifiers, menu population, recipes, stock up |
| 48ac781 | BTL SERVICE uses subcategory tab strip layout (matches Stock Up pattern) |
| 5a69a69 | BTL SVC from inv_products + bottle_price + 2oz pour default |
