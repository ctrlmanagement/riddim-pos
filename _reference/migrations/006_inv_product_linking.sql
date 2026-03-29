-- ============================================
-- RIDDIM POS — P0a: Link pos_menu_items → inv_products
-- Run in Supabase SQL Editor (cloud)
-- Session 90 — Every POS sale traces back to its inv_products SKU
-- ============================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: INSERT missing inv_products SKUs
-- ══════════════════════════════════════════════════════════════

-- New well spirits
INSERT INTO inv_products (name, category, subcategory, std_pour_oz, active)
VALUES ('Jose Cuervo Tradicional Reposado', 'TEQUILA', 'Reposado', 2, true);

INSERT INTO inv_products (name, category, subcategory, std_pour_oz, active)
VALUES ('Four Roses Yellow Label', 'WHISKEY', 'Bourbon', 2, true);

-- Rare / allocated (not previously in inventory)
INSERT INTO inv_products (name, category, subcategory, std_pour_oz, bottle_price, active)
VALUES ('Hennessy Paradis', 'COGNAC', 'XO', 2, NULL, true);

INSERT INTO inv_products (name, category, subcategory, std_pour_oz, bottle_price, active)
VALUES ('Rémy Martin Louis XIII', 'COGNAC', 'XO', 2, NULL, true);

INSERT INTO inv_products (name, category, subcategory, std_pour_oz, bottle_price, active)
VALUES ('Don Julio Última Reserva', 'TEQUILA', 'Añejo', 2, NULL, true);

INSERT INTO inv_products (name, category, subcategory, std_pour_oz, bottle_price, active)
VALUES ('Clase Azul Ultra', 'TEQUILA', 'Añejo', 2, NULL, true);

INSERT INTO inv_products (name, category, subcategory, std_pour_oz, bottle_price, active)
VALUES ('WhistlePig 18', 'WHISKEY', 'Rye', 2, NULL, true);

-- Missing standard products
INSERT INTO inv_products (name, category, subcategory, std_pour_oz, active)
VALUES ('Blue Moon', 'BEER', 'Craft', 2, true);

INSERT INTO inv_products (name, category, subcategory, std_pour_oz, active)
VALUES ('Casamigos Añejo', 'TEQUILA', 'Añejo', 2, true);

INSERT INTO inv_products (name, category, subcategory, std_pour_oz, active)
VALUES ('Goslings Black Seal Rum', 'RUM', 'Dark', 2, true);


-- ══════════════════════════════════════════════════════════════
-- STEP 2: SPIRIT POUR ITEMS — direct name match
-- Each UPDATE links one pos_menu_item to its inv_products SKU
-- ══════════════════════════════════════════════════════════════

-- ── COGNAC ────────────────────────────────────────────────────
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Hennessy' AND category = 'COGNAC' AND subcategory = 'VS' LIMIT 1
) WHERE name = 'Hennessy VS' AND category_id = '0989ab6d-095c-4e0a-9a0f-7ef1f5a58a3f';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Hennessy VSOP' AND category = 'COGNAC' LIMIT 1
) WHERE name = 'Hennessy VSOP' AND category_id = '0989ab6d-095c-4e0a-9a0f-7ef1f5a58a3f';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Dusse' AND category = 'COGNAC' LIMIT 1
) WHERE name = 'D''usse' AND category_id = '0989ab6d-095c-4e0a-9a0f-7ef1f5a58a3f';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Remy VSOP' AND category = 'COGNAC' LIMIT 1
) WHERE name = 'Remy VSOP' AND category_id = '0989ab6d-095c-4e0a-9a0f-7ef1f5a58a3f';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Hennessy Paradis' AND category = 'COGNAC' LIMIT 1
) WHERE name = 'Hennessy Paradis' AND category_id = '0989ab6d-095c-4e0a-9a0f-7ef1f5a58a3f';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Rémy Martin Louis XIII' AND category = 'COGNAC' LIMIT 1
) WHERE name = 'Rémy Martin Louis XIII' AND category_id = '0989ab6d-095c-4e0a-9a0f-7ef1f5a58a3f';

-- ── VODKA ─────────────────────────────────────────────────────
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Titos' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Well Vodka' AND category_id = '85269d39-52fe-414e-ab30-1ee22c7141a8';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Grey Goose' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Grey Goose' AND category_id = '85269d39-52fe-414e-ab30-1ee22c7141a8';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Belvedere' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Belvedere' AND category_id = '85269d39-52fe-414e-ab30-1ee22c7141a8';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Ciroc' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Ciroc' AND category_id = '85269d39-52fe-414e-ab30-1ee22c7141a8';

-- ── GIN ───────────────────────────────────────────────────────
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Tanqueray' AND category = 'GIN' LIMIT 1
) WHERE name = 'Well Gin' AND category_id = '0914664d-1c66-4b8d-8497-23fdc70590a3';

-- ── RUM ───────────────────────────────────────────────────────
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Bacardi Superior' AND category = 'RUM' LIMIT 1
) WHERE name = 'Well Rum' AND category_id = '3119e4c2-0d42-4389-b150-db85f0a0ba80';

-- ── TEQUILA ───────────────────────────────────────────────────
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Jose Cuervo Tradicional Reposado' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Well Tequila' AND category_id = 'e60aa94f-fd9b-488e-8529-ae7a6c847c89';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Casamigos Blanco' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Casamigos Blanco' AND category_id = 'e60aa94f-fd9b-488e-8529-ae7a6c847c89';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Casamigos Reposado' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Casamigos Repo' AND category_id = 'e60aa94f-fd9b-488e-8529-ae7a6c847c89';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Casamigos Añejo' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Casamigos Anejo' AND category_id = 'e60aa94f-fd9b-488e-8529-ae7a6c847c89';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Don Julio Silver' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Don Julio Blanco' AND category_id = 'e60aa94f-fd9b-488e-8529-ae7a6c847c89';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Don Julio 1942' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Don Julio 1942' AND category_id = 'e60aa94f-fd9b-488e-8529-ae7a6c847c89';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Patron' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Patron Silver' AND category_id = 'e60aa94f-fd9b-488e-8529-ae7a6c847c89';

-- ── WHISKEY ───────────────────────────────────────────────────
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Four Roses Yellow Label' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Well Whiskey' AND category_id = 'ade1618a-bdf3-409e-9b26-797202bd4509';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Jack Daniels' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Jack Daniels' AND category_id = 'ade1618a-bdf3-409e-9b26-797202bd4509';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Crown Royal' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Crown Royal' AND category_id = 'ade1618a-bdf3-409e-9b26-797202bd4509';

-- ── SCOTCH ────────────────────────────────────────────────────
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Johnnie Walker Black' AND category = 'SCOTCH' LIMIT 1
) WHERE name = 'Johnnie Black' AND category_id = '71c0ac5b-8c73-41a5-b50f-f4084d3cda08';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Macallan 18 Sherry Oak' AND category = 'SCOTCH' LIMIT 1
) WHERE name = 'Macallan 18 Sherry Oak' AND category_id = '71c0ac5b-8c73-41a5-b50f-f4084d3cda08';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Johnnie Walker Blue' AND category = 'SCOTCH' LIMIT 1
) WHERE name = 'Johnnie Walker Blue' AND category_id = '71c0ac5b-8c73-41a5-b50f-f4084d3cda08';

-- ── CHAMPAGNE ─────────────────────────────────────────────────
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Moet & Chandon NV' AND category = 'CHAMPAGNE' LIMIT 1
) WHERE name = 'Moet Bottle' AND category_id = 'a0071ad9-3c74-4106-b516-c6d4f0f86fea';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Veuve Clicquot' AND category = 'CHAMPAGNE' LIMIT 1
) WHERE name = 'Veuve Bottle' AND category_id = 'a0071ad9-3c74-4106-b516-c6d4f0f86fea';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Ace of Spades Brut' AND category = 'CHAMPAGNE' LIMIT 1
) WHERE name = 'Ace of Spades' AND category_id = 'a0071ad9-3c74-4106-b516-c6d4f0f86fea';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Ace of Spades Rose' AND category = 'CHAMPAGNE' LIMIT 1
) WHERE name = 'Ace of Spades Rosé' AND category_id = 'a0071ad9-3c74-4106-b516-c6d4f0f86fea';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Dom Perignon' AND category = 'CHAMPAGNE' LIMIT 1
) WHERE name = 'Dom Pérignon Vintage' AND category_id = 'a0071ad9-3c74-4106-b516-c6d4f0f86fea';

-- ── BEER ──────────────────────────────────────────────────────
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Heineken' AND category = 'BEER' LIMIT 1
) WHERE name = 'Heineken' AND category_id = '31d310c3-21e0-4245-8617-0e648cd06240';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Corona' AND category = 'BEER' LIMIT 1
) WHERE name = 'Corona' AND category_id = '31d310c3-21e0-4245-8617-0e648cd06240';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Stella Artois' AND category = 'BEER' LIMIT 1
) WHERE name = 'Stella' AND category_id = '31d310c3-21e0-4245-8617-0e648cd06240';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Blue Moon' AND category = 'BEER' LIMIT 1
) WHERE name = 'Blue Moon' AND category_id = '31d310c3-21e0-4245-8617-0e648cd06240';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Guinness Draught' AND category = 'BEER' LIMIT 1
) WHERE name = 'Guinness' AND category_id = '31d310c3-21e0-4245-8617-0e648cd06240';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Bud Light' AND category = 'BEER' LIMIT 1
) WHERE name = 'Bud Light' AND category_id = '31d310c3-21e0-4245-8617-0e648cd06240';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Modelo Especial' AND category = 'BEER' LIMIT 1
) WHERE name = 'Modelo' AND category_id = '31d310c3-21e0-4245-8617-0e648cd06240';

-- ── WINE ──────────────────────────────────────────────────────
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'House Cabernet Sauvignon' AND category = 'WINE' LIMIT 1
) WHERE name = 'House Red' AND category_id = '9180875d-565f-434e-888c-b751059d1cf2';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'House Chardonnay' AND category = 'WINE' LIMIT 1
) WHERE name = 'House White' AND category_id = '9180875d-565f-434e-888c-b751059d1cf2';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Prosecco' AND category = 'WINE' LIMIT 1
) WHERE name = 'Prosecco Glass' AND category_id = '9180875d-565f-434e-888c-b751059d1cf2';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Whispering Angel Rose' AND category = 'WINE' LIMIT 1
) WHERE name = 'Rose Glass' AND category_id = '9180875d-565f-434e-888c-b751059d1cf2';


-- ══════════════════════════════════════════════════════════════
-- STEP 3: RARE/ALLOCATED — dual-listed items link to same SKU
-- ══════════════════════════════════════════════════════════════

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Hennessy Paradis' AND category = 'COGNAC' LIMIT 1
) WHERE name = 'Hennessy Paradis' AND category_id = '2f49dd24-92f0-47a0-851f-9030d6b1c192';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Rémy Martin Louis XIII' AND category = 'COGNAC' LIMIT 1
) WHERE name = 'Rémy Martin Louis XIII' AND category_id = '2f49dd24-92f0-47a0-851f-9030d6b1c192';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Don Julio Última Reserva' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Don Julio Última Reserva' AND category_id = '2f49dd24-92f0-47a0-851f-9030d6b1c192';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Clase Azul Ultra' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Clase Azul Ultra' AND category_id = '2f49dd24-92f0-47a0-851f-9030d6b1c192';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Macallan 18 Sherry Oak' AND category = 'SCOTCH' LIMIT 1
) WHERE name = 'Macallan 18 Sherry Oak' AND category_id = '2f49dd24-92f0-47a0-851f-9030d6b1c192';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Johnnie Walker Blue' AND category = 'SCOTCH' LIMIT 1
) WHERE name = 'Johnnie Walker Blue' AND category_id = '2f49dd24-92f0-47a0-851f-9030d6b1c192';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name ILIKE 'Blanton%' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Blanton''s Gold' AND category_id = '2f49dd24-92f0-47a0-851f-9030d6b1c192';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'WhistlePig 18' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'WhistlePig 18' AND category_id = '2f49dd24-92f0-47a0-851f-9030d6b1c192';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Ace of Spades Rose' AND category = 'CHAMPAGNE' LIMIT 1
) WHERE name = 'Ace of Spades Rosé' AND category_id = '2f49dd24-92f0-47a0-851f-9030d6b1c192';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Dom Perignon' AND category = 'CHAMPAGNE' LIMIT 1
) WHERE name = 'Dom Pérignon Vintage' AND category_id = '2f49dd24-92f0-47a0-851f-9030d6b1c192';

-- WHISKEY dual-listed rare items
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name ILIKE 'Blanton%' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Blanton''s Gold' AND category_id = 'ade1618a-bdf3-409e-9b26-797202bd4509';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'WhistlePig 18' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'WhistlePig 18' AND category_id = 'ade1618a-bdf3-409e-9b26-797202bd4509';

-- TEQUILA dual-listed rare items
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Don Julio Última Reserva' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Don Julio Última Reserva' AND category_id = 'e60aa94f-fd9b-488e-8529-ae7a6c847c89';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Clase Azul Ultra' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Clase Azul Ultra' AND category_id = 'e60aa94f-fd9b-488e-8529-ae7a6c847c89';


-- ══════════════════════════════════════════════════════════════
-- STEP 4: COCKTAILS — link to default base spirit from recipe
-- Spirit modifier upgrades (P0c) will swap inv_product_id at ring-up
-- ══════════════════════════════════════════════════════════════

-- ── SIGNATURE DRINKS (d942aa6b) ───────────────────────────────
-- The RIDDIM → Hennessy VSOP
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Hennessy VSOP' AND category = 'COGNAC' LIMIT 1
) WHERE name = 'The RIDDIM' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Bassline → Woodford Reserve
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Woodford Reserve' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Bassline' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Patio Gold → Casamigos Blanco
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Casamigos Blanco' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Patio Gold' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Velvet Smoke → Del Maguey Vida mezcal
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Del Maguey Vida' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Velvet Smoke' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Concierge → Grey Goose
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Grey Goose' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Concierge' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Atlanta Sunrise → Buffalo Trace
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Buffalo Trace' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Atlanta Sunrise' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Rhythm & Rosé → Empress 1908 Gin
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Empress 1908 Gin' AND category = 'GIN' LIMIT 1
) WHERE name = 'Rhythm & Rosé' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Obsidian → D'Ussé VSOP (inv_products name: Dusse)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Dusse' AND category = 'COGNAC' LIMIT 1
) WHERE name = 'Obsidian' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- The Selector → Plantation XO
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Plantation XO' AND category = 'RUM' LIMIT 1
) WHERE name = 'The Selector' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Midnight in Midtown → Belvedere
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Belvedere' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Midnight in Midtown' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Batched Old Fashioned → Four Roses (house bourbon)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Four Roses Yellow Label' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Batched Old Fashioned' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Batched Negroni → Tanqueray (house gin)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Tanqueray' AND category = 'GIN' LIMIT 1
) WHERE name = 'Batched Negroni' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Batched Manhattan → Rittenhouse Rye
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Rittenhouse Rye' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Batched Manhattan' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Batched Margarita → Jose Cuervo (house tequila)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Jose Cuervo Tradicional Reposado' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Batched Margarita' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Batched Espresso Martini → Titos (house vodka)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Titos' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Batched Espresso Martini' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- ── CLASSIC COCKTAILS (47037cbb) ──────────────────────────────
-- Old Fashioned → Four Roses (house bourbon)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Four Roses Yellow Label' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Old Fashioned' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Riddim Punch → Goslings Black Seal Rum (signature base)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Goslings Black Seal Rum' AND category = 'RUM' LIMIT 1
) WHERE name = 'Riddim Punch' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Smoky Old Fashioned → Del Maguey Vida mezcal
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Del Maguey Vida' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Smoky Old Fashioned' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Manhattan → Rittenhouse Rye
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Rittenhouse Rye' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Manhattan' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Espresso Martini (×2) → Titos (house vodka)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Titos' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Espresso Martini' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Martini → Titos (house vodka)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Titos' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Martini' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Hennessy Sour → Hennessy VS
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Hennessy' AND category = 'COGNAC' AND subcategory = 'VS' LIMIT 1
) WHERE name = 'Hennessy Sour' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Margarita → Jose Cuervo (house tequila)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Jose Cuervo Tradicional Reposado' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Margarita' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Daiquiri → Bacardi Superior (house rum)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Bacardi Superior' AND category = 'RUM' LIMIT 1
) WHERE name = 'Daiquiri' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Passion Fruit Marg → Jose Cuervo (house tequila)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Jose Cuervo Tradicional Reposado' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Passion Fruit Marg' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Mojito (×2) → Bacardi Superior (house rum)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Bacardi Superior' AND category = 'RUM' LIMIT 1
) WHERE name = 'Mojito' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Spicy Margarita → Jose Cuervo (house tequila)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Jose Cuervo Tradicional Reposado' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Spicy Margarita' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- House Margarita → Jose Cuervo (house tequila)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Jose Cuervo Tradicional Reposado' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'House Margarita' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Dark & Stormy (×2) → Bacardi Anejo Cuatro (dark rum)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Bacardi Anejo Cuatro' AND category = 'RUM' LIMIT 1
) WHERE name = 'Dark & Stormy' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Rum Punch → Bacardi Superior (house rum)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Bacardi Superior' AND category = 'RUM' LIMIT 1
) WHERE name = 'Rum Punch' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Whiskey Sour → Four Roses (house bourbon)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Four Roses Yellow Label' AND category = 'WHISKEY' LIMIT 1
) WHERE name = 'Whiskey Sour' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Long Island → Titos (primary spirit for tracking, multi-spirit drink)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Titos' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Long Island' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Negroni → Tanqueray (house gin)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Tanqueray' AND category = 'GIN' LIMIT 1
) WHERE name = 'Negroni' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Paloma → Jose Cuervo (house tequila)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Jose Cuervo Tradicional Reposado' AND category = 'TEQUILA' LIMIT 1
) WHERE name = 'Paloma' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- French 75 → Tanqueray (house gin)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Tanqueray' AND category = 'GIN' LIMIT 1
) WHERE name = 'French 75' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Moscow Mule → Titos (house vodka)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Titos' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Moscow Mule' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Aperol Spritz → Aperol (CORDIAL)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Aperol' AND category = 'CORDIAL' LIMIT 1
) WHERE name = 'Aperol Spritz' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- Cosmopolitan → Titos (house vodka)
UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Titos' AND category = 'VODKA' LIMIT 1
) WHERE name = 'Cosmopolitan' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';


-- ══════════════════════════════════════════════════════════════
-- STEP 5: NON-ALCOHOLIC — link to BEVERAGE inv_products
-- ══════════════════════════════════════════════════════════════

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Red Bull' AND category = 'BEVERAGE' LIMIT 1
) WHERE name = 'Red Bull' AND category_id = '0767939d-b99a-4cc4-a439-b2ccfadbec37';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Cranberry' AND category = 'BEVERAGE' LIMIT 1
) WHERE name = 'Cranberry' AND category_id = '0767939d-b99a-4cc4-a439-b2ccfadbec37';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Pineapple Juice' AND category = 'BEVERAGE' LIMIT 1
) WHERE name = 'Pineapple' AND category_id = '0767939d-b99a-4cc4-a439-b2ccfadbec37';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Fever-Tree Ginger Beer' AND category = 'BEVERAGE' LIMIT 1
) WHERE name = 'Ginger Beer' AND category_id = '0767939d-b99a-4cc4-a439-b2ccfadbec37';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Club Soda' AND category = 'BEVERAGE' LIMIT 1
) WHERE name = 'Soda' AND category_id = '0767939d-b99a-4cc4-a439-b2ccfadbec37';

UPDATE pos_menu_items SET inv_product_id = (
  SELECT id FROM inv_products WHERE name = 'Still Water' AND category = 'BEVERAGE' LIMIT 1
) WHERE name = 'Water' AND category_id = '0767939d-b99a-4cc4-a439-b2ccfadbec37';


-- ══════════════════════════════════════════════════════════════
-- STEP 6: RIDDIM PUNCH RECIPE — Bar Builders cocktail build
-- Goslings Black Seal anchors a Caribbean rum punch with
-- pineapple, passion fruit, citrus, and Angostura — built for
-- RIDDIM's hip-hop supper club energy. Batch-friendly.
-- ══════════════════════════════════════════════════════════════

UPDATE pos_menu_items SET recipe = '{
  "specs": [
    "2 oz Goslings Black Seal Rum",
    "1 oz pineapple juice",
    "0.75 oz passion fruit purée",
    "0.75 oz fresh lime juice",
    "0.5 oz demerara syrup",
    "3 dashes Angostura bitters",
    "Freshly grated nutmeg"
  ],
  "method": "Shake all ingredients except nutmeg hard with ice. Strain into Collins glass over fresh ice. Grate nutmeg on top.",
  "garnish": "Pineapple wedge, freshly grated nutmeg, edible orchid",
  "glassware": "Collins"
}'::jsonb
WHERE name = 'Riddim Punch' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';


-- ══════════════════════════════════════════════════════════════
-- STEP 7: VERIFICATION — expect 102 linked, 13 unlinked, 115 total
-- ══════════════════════════════════════════════════════════════

-- Intentionally NULL (13):
--   FOOD (6): Jerk Wings, Oxtail Sliders, Fried Plantains, Curry Shrimp, Loaded Fries, Fish Tacos
--   HOOKAH (3): Hookah Single, Hookah Double, Extra Bowl
--   ZERO PROOF (4): Golden Hour, The Muse, Velvet Garden, Midnight Bloom

SELECT
  (SELECT count(*) FROM pos_menu_items WHERE active = true AND inv_product_id IS NOT NULL) AS linked,
  (SELECT count(*) FROM pos_menu_items WHERE active = true AND inv_product_id IS NULL) AS unlinked,
  (SELECT count(*) FROM pos_menu_items WHERE active = true) AS total;
