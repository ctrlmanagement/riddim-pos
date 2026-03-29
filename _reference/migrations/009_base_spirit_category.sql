-- Migration 009: Add base_spirit_category_id to pos_menu_items
-- Purpose: Links cocktails to their base spirit category so the spirit upgrade
--          picker only shows relevant spirits (e.g., Manhattan → Whiskey only).
-- Date: 2026-03-29 (S91)

-- Add column
ALTER TABLE pos_menu_items
  ADD COLUMN base_spirit_category_id uuid REFERENCES pos_menu_categories(id);

-- Index for fast lookup
CREATE INDEX idx_pos_menu_items_base_spirit_cat
  ON pos_menu_items(base_spirit_category_id)
  WHERE base_spirit_category_id IS NOT NULL;

-- Deactivate the static Spirit modifier group (replaced by dynamic picker)
UPDATE pos_modifier_groups SET active = false WHERE name = 'Spirit';

-- =============================================================================
-- Populate base_spirit_category_id for existing cocktails
-- Run after migration — adjust item names to match your actual menu items.
-- =============================================================================

-- Helper: get category IDs
-- SELECT id, name FROM pos_menu_categories WHERE name IN ('Whiskey','Vodka','Tequila','Rum','Gin','Cognac','Scotch');

-- Example updates (run manually per your actual menu):
-- UPDATE pos_menu_items SET base_spirit_category_id = (SELECT id FROM pos_menu_categories WHERE name = 'Whiskey') WHERE name IN ('Manhattan','Old Fashioned','Whiskey Sour');
-- UPDATE pos_menu_items SET base_spirit_category_id = (SELECT id FROM pos_menu_categories WHERE name = 'Vodka') WHERE name IN ('Cosmopolitan','Espresso Martini','Moscow Mule');
-- UPDATE pos_menu_items SET base_spirit_category_id = (SELECT id FROM pos_menu_categories WHERE name = 'Tequila') WHERE name IN ('Margarita','Paloma');
-- UPDATE pos_menu_items SET base_spirit_category_id = (SELECT id FROM pos_menu_categories WHERE name = 'Rum') WHERE name IN ('Mojito','Daiquiri');
-- UPDATE pos_menu_items SET base_spirit_category_id = (SELECT id FROM pos_menu_categories WHERE name = 'Gin') WHERE name IN ('Negroni','Gin & Tonic');
-- UPDATE pos_menu_items SET base_spirit_category_id = (SELECT id FROM pos_menu_categories WHERE name = 'Cognac') WHERE name IN ('Sidecar','Hennessy Margarita');
