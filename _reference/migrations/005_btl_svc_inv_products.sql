-- ============================================
-- RIDDIM POS — BTL SVC from inv_products + bottle_price + 2oz pour
-- Run in Supabase SQL Editor (cloud)
-- Session 89 — Bar Builders Phase 2
-- ============================================

-- ── ADD bottle_price TO inv_products ────────────────────────
-- NULL = MARKET (owner/GM sets at ring-up)
-- Numeric = fixed bottle service price
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS bottle_price numeric(10,2);

-- ── UPDATE std_pour_oz DEFAULT TO 2 ─────────────────────────
ALTER TABLE inv_products ALTER COLUMN std_pour_oz SET DEFAULT 2;

-- Update existing products that still have the old 1.25 default
UPDATE inv_products SET std_pour_oz = 2 WHERE std_pour_oz = 1.25;

-- ── SET bottle_price FOR KNOWN BTL SVC ITEMS ────────────────
-- Match by name against the pos_menu_items BTL SVC prices we already set
-- Cognac
UPDATE inv_products SET bottle_price = 250 WHERE name ILIKE 'Hennessy VS' AND category = 'COGNAC';
UPDATE inv_products SET bottle_price = 350 WHERE name ILIKE 'Hennessy VSOP' AND category = 'COGNAC';
UPDATE inv_products SET bottle_price = 350 WHERE name ILIKE 'D''Ussé VSOP' AND category = 'COGNAC';
UPDATE inv_products SET bottle_price = 300 WHERE name ILIKE 'Rémy Martin VSOP' AND category = 'COGNAC';
-- Vodka
UPDATE inv_products SET bottle_price = 250 WHERE name ILIKE 'Tito%' AND category = 'VODKA';
UPDATE inv_products SET bottle_price = 300 WHERE name ILIKE 'Grey Goose' AND category = 'VODKA';
UPDATE inv_products SET bottle_price = 300 WHERE name ILIKE 'Belvedere' AND category = 'VODKA';
UPDATE inv_products SET bottle_price = 300 WHERE name ILIKE 'Cîroc' AND category = 'VODKA' AND (subcategory IS NULL OR subcategory = 'Standard' OR subcategory = 'Premium');
-- Tequila
UPDATE inv_products SET bottle_price = 250 WHERE name ILIKE 'Espolòn Blanco' AND category = 'TEQUILA';
UPDATE inv_products SET bottle_price = 300 WHERE name ILIKE 'Casamigos Blanco' AND category = 'TEQUILA';
UPDATE inv_products SET bottle_price = 300 WHERE name ILIKE 'Don Julio Blanco' AND category = 'TEQUILA';
UPDATE inv_products SET bottle_price = 500 WHERE name ILIKE 'Don Julio 1942' AND category = 'TEQUILA';
-- Whiskey
UPDATE inv_products SET bottle_price = 250 WHERE name ILIKE 'Buffalo Trace%' AND category = 'WHISKEY';
UPDATE inv_products SET bottle_price = 250 WHERE name ILIKE 'Crown Royal' AND category = 'WHISKEY';
UPDATE inv_products SET bottle_price = 250 WHERE name ILIKE 'Jameson%' AND category = 'WHISKEY' AND (subcategory IS NULL OR subcategory = 'Irish');
UPDATE inv_products SET bottle_price = 300 WHERE name ILIKE 'Woodford Reserve' AND category = 'WHISKEY';
-- Rum
UPDATE inv_products SET bottle_price = 250 WHERE name ILIKE 'Bacardi Superior' AND category = 'RUM';
-- Gin
UPDATE inv_products SET bottle_price = 250 WHERE name ILIKE 'Tanqueray%' AND category = 'GIN';
-- Champagne
UPDATE inv_products SET bottle_price = 300 WHERE name ILIKE 'Moët%' AND category = 'CHAMPAGNE';
UPDATE inv_products SET bottle_price = 350 WHERE name ILIKE 'Veuve Clicquot%' AND category = 'CHAMPAGNE';
UPDATE inv_products SET bottle_price = 800 WHERE name ILIKE 'Ace of Spades%' AND category = 'CHAMPAGNE';
UPDATE inv_products SET bottle_price = 600 WHERE name ILIKE 'Dom Pérignon%' AND category = 'CHAMPAGNE';

-- ── DELETE DUPLICATE BTL SVC ITEMS FROM pos_menu_items ──────
-- These were manually inserted in migration 002 — no longer needed
-- BTL SVC now renders from inv_products directly
DELETE FROM pos_menu_items
WHERE category_id = 'e8c47563-ee54-4b82-b40a-4d18772e02ba';
