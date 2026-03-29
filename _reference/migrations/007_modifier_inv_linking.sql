-- ============================================
-- RIDDIM POS — P0b: Link pos_modifiers → inv_products
-- Run in Supabase SQL Editor (cloud)
-- Session 90 — Spirit upgrade modifiers trace back to inv SKU
-- ============================================

-- ── ADD inv_product_id TO pos_modifiers ───────────────────────
ALTER TABLE pos_modifiers ADD COLUMN IF NOT EXISTS inv_product_id uuid REFERENCES inv_products(id);

-- ══════════════════════════════════════════════════════════════
-- LINK 12 SPIRIT UPGRADE MODIFIERS
-- When bartender selects these, P0c swaps the order line's
-- inv_product_id from house spirit → upgrade spirit
-- ══════════════════════════════════════════════════════════════

-- Don Julio 1942 (+$12)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Don Julio 1942' AND category = 'TEQUILA' LIMIT 1
) WHERE id = 'e8314134-6fe8-42d1-a327-4c44de301314';

-- Clase Azul Repo (+$10)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Clase Azul Reposado' AND category = 'TEQUILA' LIMIT 1
) WHERE id = '6226220e-999b-42b6-86c0-9b6801dc9ac8';

-- Casamigos Repo (+$5)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Casamigos Reposado' AND category = 'TEQUILA' LIMIT 1
) WHERE id = '79033613-d745-416d-8922-5e905659f311';

-- Casamigos Blanco (+$4)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Casamigos Blanco' AND category = 'TEQUILA' LIMIT 1
) WHERE id = '594fe0d4-3ff9-49b9-8f78-16aabdbcfc91';

-- Hennessy VSOP (+$5)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Hennessy VSOP' AND category = 'COGNAC' LIMIT 1
) WHERE id = 'f8d39b07-8956-41fb-9f6a-0253da0996e0';

-- D'Ussé VSOP (+$5)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Dusse' AND category = 'COGNAC' LIMIT 1
) WHERE id = '26757c47-86b1-4e1f-958c-5a400702bc70';

-- Grey Goose (+$4)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Grey Goose' AND category = 'VODKA' LIMIT 1
) WHERE id = 'f4ec5cbf-5e94-49eb-ac2f-1894928b5b84';

-- Belvedere (+$4)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Belvedere' AND category = 'VODKA' LIMIT 1
) WHERE id = 'd7d732e3-f17f-436d-98d2-69c9259f7cc5';

-- Woodford Reserve (+$4)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Woodford Reserve' AND category = 'WHISKEY' LIMIT 1
) WHERE id = '364aad99-5eef-46e1-b70d-43d5b7f5fc9b';

-- Macallan 12 (+$6)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Macallan 12 Double Cask' AND category = 'SCOTCH' LIMIT 1
) WHERE id = '0cde1ec5-31af-46bc-8c37-41e7f8a8a206';

-- Patron Silver (+$5)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Patron' AND category = 'TEQUILA' LIMIT 1
) WHERE id = 'bb39650d-fc75-46d5-b5f9-4f2bb2270cf9';

-- Johnnie Walker Black (+$5)
UPDATE pos_modifiers SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Johnnie Walker Black' AND category = 'SCOTCH' LIMIT 1
) WHERE id = '2ef6a501-9b0b-4183-bf29-2271b334c824';


-- ══════════════════════════════════════════════════════════════
-- VERIFICATION — all 12 spirit modifiers should be linked
-- ══════════════════════════════════════════════════════════════

SELECT
  (SELECT count(*) FROM pos_modifiers WHERE inv_product_id IS NOT NULL) AS linked,
  (SELECT count(*) FROM pos_modifiers WHERE group_id = '9fd6fcf6-acae-4e87-98f4-b2b2834397c0' AND inv_product_id IS NULL) AS spirit_unlinked,
  (SELECT count(*) FROM pos_modifiers WHERE active = true) AS total;
