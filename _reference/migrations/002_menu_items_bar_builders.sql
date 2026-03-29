-- ============================================
-- RIDDIM POS — Bar Builders Phase 2: Menu Item Population
-- Run in Supabase SQL Editor (cloud)
-- Session 89 — Populates Signature Drinks, Cocktails, Zero Proof,
--              BTL SVC, Rare/Allocated, and marks Fast Keys as speed_rail
-- ============================================

-- Category IDs (from pos_menu_categories):
-- BEER             31d310c3-21e0-4245-8617-0e648cd06240
-- VODKA            85269d39-52fe-414e-ab30-1ee22c7141a8
-- CHAMP            a0071ad9-3c74-4106-b516-c6d4f0f86fea
-- RUM              3119e4c2-0d42-4389-b150-db85f0a0ba80
-- WINE             9180875d-565f-434e-888c-b751059d1cf2
-- GIN              0914664d-1c66-4b8d-8497-23fdc70590a3
-- COCKTAILS        47037cbb-cd33-41f5-98aa-d61be34e4b40
-- TEQUILA          e60aa94f-fd9b-488e-8529-ae7a6c847c89
-- SIGNATURE DRINKS d942aa6b-7068-4f14-b074-0dcc1e34c88f
-- WHISKEY          ade1618a-bdf3-409e-9b26-797202bd4509
-- COGNAC           0989ab6d-095c-4e0a-9a0f-7ef1f5a58a3f
-- NON ALCOHOLIC    0767939d-b99a-4cc4-a439-b2ccfadbec37
-- SCOTCH           71c0ac5b-8c73-41a5-b50f-f4084d3cda08
-- BTL SERVICE      e8c47563-ee54-4b82-b40a-4d18772e02ba

-- ── CREATE "RARE/ALLOCATED" CATEGORY ────────────────────────
INSERT INTO pos_menu_categories (name, sort_order, color, active)
VALUES ('RARE/ALLOCATED', 23, '#8B6914', true);

-- ══════════════════════════════════════════════════════════════
-- SIGNATURE DRINKS (10 signatures + 5 batched = 15 items)
-- ══════════════════════════════════════════════════════════════

INSERT INTO pos_menu_items (name, price, category_id, sort_order, active) VALUES
  ('The RIDDIM',                18, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 1,  true),
  ('Bassline',                  19, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 2,  true),
  ('Patio Gold',                16, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 3,  true),
  ('Velvet Smoke',              17, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 4,  true),
  ('Concierge',                 22, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 5,  true),
  ('Atlanta Sunrise',           18, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 6,  true),
  ('Rhythm & Rosé',             17, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 7,  true),
  ('Obsidian',                  20, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 8,  true),
  ('The Selector',              17, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 9,  true),
  ('Midnight in Midtown',       18, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 10, true),
  -- Batched (included in Signature Drinks per owner direction)
  ('Batched Old Fashioned',     15, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 11, true),
  ('Batched Negroni',           15, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 12, true),
  ('Batched Manhattan',         16, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 13, true),
  ('Batched Margarita',         14, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 14, true),
  ('Batched Espresso Martini',  16, 'd942aa6b-7068-4f14-b074-0dcc1e34c88f', 15, true);

-- ══════════════════════════════════════════════════════════════
-- CLASSIC COCKTAILS (15 items — COCKTAILS category)
-- ══════════════════════════════════════════════════════════════

INSERT INTO pos_menu_items (name, price, category_id, sort_order, active) VALUES
  ('Old Fashioned',     15, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 1,  true),
  ('Manhattan',         16, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 2,  true),
  ('Martini',           16, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 3,  true),
  ('Margarita',         15, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 4,  true),
  ('Daiquiri',          14, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 5,  true),
  ('Mojito',            15, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 6,  true),
  ('Whiskey Sour',      15, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 7,  true),
  ('Espresso Martini',  17, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 8,  true),
  ('Negroni',           15, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 9,  true),
  ('Paloma',            14, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 10, true),
  ('French 75',         18, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 11, true),
  ('Dark & Stormy',     14, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 12, true),
  ('Moscow Mule',       14, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 13, true),
  ('Aperol Spritz',     15, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 14, true),
  ('Cosmopolitan',      16, '47037cbb-cd33-41f5-98aa-d61be34e4b40', 15, true);

-- ══════════════════════════════════════════════════════════════
-- ZERO PROOF (4 items — NON ALCOHOLIC category)
-- ══════════════════════════════════════════════════════════════

INSERT INTO pos_menu_items (name, price, category_id, sort_order, active) VALUES
  ('Golden Hour',     12, '0767939d-b99a-4cc4-a439-b2ccfadbec37', 1, true),
  ('The Muse',        12, '0767939d-b99a-4cc4-a439-b2ccfadbec37', 2, true),
  ('Velvet Garden',   11, '0767939d-b99a-4cc4-a439-b2ccfadbec37', 3, true),
  ('Midnight Bloom',  13, '0767939d-b99a-4cc4-a439-b2ccfadbec37', 4, true);

-- ══════════════════════════════════════════════════════════════
-- RARE / ALLOCATED SPIRITS (10 items)
-- In RARE/ALLOCATED category + dual-listed in spirit categories
-- ══════════════════════════════════════════════════════════════

-- Get the new RARE/ALLOCATED category ID
DO $$
DECLARE
  rare_id uuid;
BEGIN
  SELECT id INTO rare_id FROM pos_menu_categories WHERE name = 'RARE/ALLOCATED';

  INSERT INTO pos_menu_items (name, price, category_id, sort_order, active) VALUES
    ('Hennessy Paradis',           800,  rare_id, 1,  true),
    ('Rémy Martin Louis XIII',     3000, rare_id, 2,  true),
    ('Don Julio Última Reserva',   500,  rare_id, 3,  true),
    ('Clase Azul Ultra',           2000, rare_id, 4,  true),
    ('Macallan 18 Sherry Oak',     700,  rare_id, 5,  true),
    ('Johnnie Walker Blue',        500,  rare_id, 6,  true),
    ('Blanton''s Gold',            400,  rare_id, 7,  true),
    ('WhistlePig 18',              500,  rare_id, 8,  true),
    ('Ace of Spades Rosé',         800,  rare_id, 9,  true),
    ('Dom Pérignon Vintage',       600,  rare_id, 10, true);
END $$;

-- Dual-list in spirit categories
INSERT INTO pos_menu_items (name, price, category_id, sort_order, active) VALUES
  ('Hennessy Paradis',           800,  '0989ab6d-095c-4e0a-9a0f-7ef1f5a58a3f', 90, true),
  ('Rémy Martin Louis XIII',     3000, '0989ab6d-095c-4e0a-9a0f-7ef1f5a58a3f', 91, true),
  ('Don Julio Última Reserva',   500,  'e60aa94f-fd9b-488e-8529-ae7a6c847c89', 90, true),
  ('Clase Azul Ultra',           2000, 'e60aa94f-fd9b-488e-8529-ae7a6c847c89', 91, true),
  ('Macallan 18 Sherry Oak',     700,  '71c0ac5b-8c73-41a5-b50f-f4084d3cda08', 90, true),
  ('Johnnie Walker Blue',        500,  '71c0ac5b-8c73-41a5-b50f-f4084d3cda08', 91, true),
  ('Blanton''s Gold',            400,  'ade1618a-bdf3-409e-9b26-797202bd4509', 90, true),
  ('WhistlePig 18',              500,  'ade1618a-bdf3-409e-9b26-797202bd4509', 91, true),
  ('Ace of Spades Rosé',         800,  'a0071ad9-3c74-4106-b516-c6d4f0f86fea', 90, true),
  ('Dom Pérignon Vintage',       600,  'a0071ad9-3c74-4106-b516-c6d4f0f86fea', 91, true);

-- ══════════════════════════════════════════════════════════════
-- BTL SERVICE — Bottle service items by spirit type
-- ══════════════════════════════════════════════════════════════

INSERT INTO pos_menu_items (name, price, category_id, sort_order, active) VALUES
  -- Cognac bottles
  ('Hennessy VS (Btl)',          250, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 1,  true),
  ('Hennessy VSOP (Btl)',        350, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 2,  true),
  ('D''Ussé VSOP (Btl)',         350, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 3,  true),
  ('Rémy Martin VSOP (Btl)',     300, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 4,  true),
  -- Vodka bottles
  ('Tito''s (Btl)',              250, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 10, true),
  ('Grey Goose (Btl)',           300, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 11, true),
  ('Belvedere (Btl)',            300, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 12, true),
  ('Cîroc (Btl)',                300, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 13, true),
  -- Tequila bottles
  ('Espolòn Blanco (Btl)',       250, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 20, true),
  ('Casamigos Blanco (Btl)',     300, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 21, true),
  ('Don Julio Blanco (Btl)',     300, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 22, true),
  ('Don Julio 1942 (Btl)',       500, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 23, true),
  -- Whiskey bottles
  ('Buffalo Trace (Btl)',        250, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 30, true),
  ('Crown Royal (Btl)',          250, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 31, true),
  ('Jameson (Btl)',              250, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 32, true),
  ('Woodford Reserve (Btl)',     300, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 33, true),
  -- Rum bottles
  ('Bacardi Superior (Btl)',     250, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 40, true),
  -- Gin bottles
  ('Tanqueray (Btl)',            250, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 50, true),
  -- Champagne bottles
  ('Moët & Chandon NV (Btl)',    300, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 60, true),
  ('Veuve Clicquot (Btl)',       350, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 61, true),
  ('Ace of Spades (Btl)',        800, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 62, true),
  ('Dom Pérignon (Btl)',         600, 'e8c47563-ee54-4b82-b40a-4d18772e02ba', 63, true);

-- ══════════════════════════════════════════════════════════════
-- FAST KEYS — Mark 8 premium rail items as speed_rail
-- ══════════════════════════════════════════════════════════════

UPDATE pos_menu_items SET speed_rail = true
WHERE name IN (
  'Hennessy VS',
  'Tito''s Handmade Vodka',
  'Tito''s',
  'Espolòn Blanco',
  'Bacardi Superior',
  'Tanqueray London Dry',
  'Tanqueray',
  'Buffalo Trace Bourbon',
  'Buffalo Trace',
  'Jameson Irish Whiskey',
  'Jameson',
  'Crown Royal'
) AND active = true;
