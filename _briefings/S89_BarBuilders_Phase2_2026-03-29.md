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

### Menu Items Populated (77 new items, 137 total)
- **15 Signature Drinks** (10 originals + 5 batched) — `SIGNATURE DRINKS` category
- **15 Classic Cocktails** — `COCKTAILS` category
- **4 Zero Proof** — `NON ALCOHOLIC` category
- **10 Rare/Allocated** — new `RARE/ALLOCATED` category (#23) + dual-listed in spirit categories
- **22 Btl Service** — `BTL SERVICE` category, grouped by subcategory
- **8 Fast Keys** marked `speed_rail = true`

### Subcategory Grouping
- `subcategory` column on `pos_menu_items`
- BTL SERVICE items grouped under COGNAC / VODKA / TEQUILA / WHISKEY / RUM / GIN / CHAMPAGNE headers
- Menu grid renders group headers when items have subcategories

### Recipe Viewer
- `recipe` jsonb column on `pos_menu_items` (specs, method, glassware, garnish, shelfLife)
- 34 cocktails have full recipes (10 signatures, 5 batched, 15 classics, 4 zero proof)
- Gold **i** button on menu items with recipes → tap opens recipe card modal
- Batched drinks show shelf life

## Migrations Run
| File | What |
|------|------|
| 001_modifiers.sql | Modifier tables + RLS + seed data |
| 002_menu_items_bar_builders.sql | 77 menu items + Rare/Allocated category + Fast Keys |
| 003_menu_subcategory_recipes.sql | subcategory + recipe columns, BTL SVC grouping, 34 recipes |
| 004_modifier_upcharges.sql | price column on modifiers, Spirit upgrade group (12 options) |

## Files Changed
| File | Change |
|------|--------|
| server/db/schema.sql | Modifier tables + modifiers column on order lines |
| server/db/supabase-schema.sql | modifiers column on sync table |
| server/routes/orders.js | Stores modifiers jsonb on line insert |
| server/sync/index.js | Includes modifiers in Supabase sync |
| server/printer/escpos.js | Prints modifiers on thermal receipt |
| terminal/index.html | Recipe modal + modifier picker modal + script tags |
| terminal/js/core.js | Loads modifier groups + subcategory + recipe at startup |
| terminal/js/modifiers.js | NEW — modifier picker with upcharge support |
| terminal/js/menu.js | Subcategory headers, recipe viewer, routes taps through modifier picker |
| terminal/js/cart.js | Displays modifiers in cart lines |
| terminal/js/receipt.js | Displays modifiers on receipt HTML |
| terminal/js/server-link.js | Sends/reads modifiers on line persistence + hydration |
| terminal/css/modifiers.css | NEW — modifier picker, subcategory headers, recipe card styles |
| terminal/css/menu.css | position:relative on .menu-item for recipe button |

## Deferred: BOH Menu Management (Next Session)

### Current State
The management screen has basic CRUD for menu items and categories (`mgmt-menu.js`, `mgmt-categories.js`). It supports:
- Add/edit/delete menu items (name, price, category, speed rail, sort order)
- Add/edit categories (name, color, sort order)

### What's Missing
| Feature | Detail |
|---------|--------|
| **Subcategory management** | No UI to set/edit subcategory on items. Currently SQL-only. |
| **Recipe management** | No UI to add/edit recipes. Currently SQL-only. |
| **Multi-category items** | Items like Herradura should appear in both the spirit category (TEQUILA) and BTL SERVICE. Currently requires duplicate rows. Need a linking table or UI for dual-listing. |
| **Modifier management** | No UI to add/edit/delete modifier groups or options. Currently SQL-only. |
| **Modifier upcharge editing** | No UI to change spirit upgrade prices. Currently SQL-only. |

### Recommended Build Order
1. Add subcategory dropdown to item add/edit modal
2. Add recipe editor (specs list, method, glassware, garnish fields)
3. Add modifier group CRUD in management panel (new mgmt section)
4. Add modifier option CRUD with price field
5. Multi-category support — either a linking table or a "copy to category" action

### Architecture Note
Multi-category items (e.g., Herradura in TEQUILA + BTL SERVICE) currently work via duplicate rows with different `category_id`. This is simple and works for the terminal, but means price changes need to update multiple rows. A proper solution would be a `pos_menu_item_categories` junction table, but that's a bigger refactor. For now, the duplicate approach is fine for the ~10 items that need dual-listing.
