-- ============================================
-- RIDDIM POS — Subcategories + Recipe Data
-- Run in Supabase SQL Editor (cloud)
-- Session 89 — Bar Builders Phase 2
-- ============================================

-- ── ADD COLUMNS ─────────────────────────────────────────────
ALTER TABLE pos_menu_items ADD COLUMN IF NOT EXISTS subcategory text;
ALTER TABLE pos_menu_items ADD COLUMN IF NOT EXISTS recipe jsonb;
-- recipe format: { "specs": [...], "method": "...", "glassware": "...", "garnish": "..." }

-- ══════════════════════════════════════════════════════════════
-- BTL SERVICE SUBCATEGORIES
-- ══════════════════════════════════════════════════════════════

UPDATE pos_menu_items SET subcategory = 'COGNAC'    WHERE category_id = 'e8c47563-ee54-4b82-b40a-4d18772e02ba' AND name ILIKE '%Hennessy%' OR (category_id = 'e8c47563-ee54-4b82-b40a-4d18772e02ba' AND name ILIKE '%D''Ussé%') OR (category_id = 'e8c47563-ee54-4b82-b40a-4d18772e02ba' AND name ILIKE '%Rémy%');
UPDATE pos_menu_items SET subcategory = 'VODKA'     WHERE category_id = 'e8c47563-ee54-4b82-b40a-4d18772e02ba' AND name IN ('Tito''s (Btl)', 'Grey Goose (Btl)', 'Belvedere (Btl)', 'Cîroc (Btl)');
UPDATE pos_menu_items SET subcategory = 'TEQUILA'   WHERE category_id = 'e8c47563-ee54-4b82-b40a-4d18772e02ba' AND name IN ('Espolòn Blanco (Btl)', 'Casamigos Blanco (Btl)', 'Don Julio Blanco (Btl)', 'Don Julio 1942 (Btl)');
UPDATE pos_menu_items SET subcategory = 'WHISKEY'   WHERE category_id = 'e8c47563-ee54-4b82-b40a-4d18772e02ba' AND name IN ('Buffalo Trace (Btl)', 'Crown Royal (Btl)', 'Jameson (Btl)', 'Woodford Reserve (Btl)');
UPDATE pos_menu_items SET subcategory = 'RUM'       WHERE category_id = 'e8c47563-ee54-4b82-b40a-4d18772e02ba' AND name = 'Bacardi Superior (Btl)';
UPDATE pos_menu_items SET subcategory = 'GIN'       WHERE category_id = 'e8c47563-ee54-4b82-b40a-4d18772e02ba' AND name = 'Tanqueray (Btl)';
UPDATE pos_menu_items SET subcategory = 'CHAMPAGNE' WHERE category_id = 'e8c47563-ee54-4b82-b40a-4d18772e02ba' AND name IN ('Moët & Chandon NV (Btl)', 'Veuve Clicquot (Btl)', 'Ace of Spades (Btl)', 'Dom Pérignon (Btl)');

-- ══════════════════════════════════════════════════════════════
-- SIGNATURE DRINKS — RECIPES
-- ══════════════════════════════════════════════════════════════

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz Hennessy VSOP","0.75 oz fresh lemon juice","0.5 oz St-Germain elderflower","0.25 oz black walnut bitters"],"method":"Shake all with ice. Double strain into chilled coupe. Smoke rosemary sprig tableside.","glassware":"Coupe","garnish":"Flamed rosemary sprig"}'
WHERE name = 'The RIDDIM' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz Woodford Reserve","0.5 oz Amaro Montenegro","0.5 oz demerara syrup","2 dash Angostura bitters","2 dash orange bitters"],"method":"Stir all with ice for 30 seconds. Strain over large rock.","glassware":"Rocks","garnish":"Expressed orange peel, Luxardo cherry"}'
WHERE name = 'Bassline' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz Casamigos Blanco","1 oz fresh lime juice","0.75 oz passionfruit purée","0.5 oz agave nectar"],"method":"Half-rim rocks glass with chili-lime salt. Shake all with ice. Strain over fresh ice.","glassware":"Rocks","garnish":"Dehydrated lime wheel, Tajín half-rim"}'
WHERE name = 'Patio Gold' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["1.5 oz Del Maguey Vida mezcal","0.5 oz Cîroc vodka","1 oz blackberry-ginger shrub","0.75 oz fresh lime juice","1 drop activated charcoal"],"method":"Shake all with ice. Double strain into chilled coupe. Smoke dome presentation.","glassware":"Coupe","garnish":"Blackberry skewer, smoked sea salt rim"}'
WHERE name = 'Velvet Smoke' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["1.5 oz Grey Goose","0.75 oz St-Germain","0.5 oz white peach purée","Top with Moët & Chandon NV"],"method":"Shake base with ice. Strain into chilled flute. Top with champagne, gentle stir.","glassware":"Flute","garnish":"Edible orchid"}'
WHERE name = 'Concierge' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz Buffalo Trace","1 oz fresh peach purée","0.75 oz fresh lemon juice","0.5 oz honey-ginger syrup","1 dash Peychaud''s bitters"],"method":"Shake all with ice. Strain over sphere ice in rocks glass.","glassware":"Rocks","garnish":"Dehydrated peach slice, edible gold leaf"}'
WHERE name = 'Atlanta Sunrise' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["1.5 oz Empress 1908 gin","1 oz rosé wine reduction","0.75 oz fresh lemon juice","0.5 oz lavender syrup","Top with prosecco"],"method":"Shake base with ice. Strain into wine glass over ice. Top with prosecco.","glassware":"Wine glass","garnish":"Edible flowers, lavender sprig"}'
WHERE name = 'Rhythm & Rosé' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz D''Ussé VSOP","0.75 oz fresh espresso","0.5 oz vanilla syrup","0.25 oz Kahlúa","Heavy cream float"],"method":"Shake cognac, espresso, vanilla, and Kahlúa with ice. Strain over sphere ice. Float cream.","glassware":"Rocks","garnish":"3 espresso beans, gold dust rim"}'
WHERE name = 'Obsidian' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["1.5 oz Plantation XO rum","0.5 oz coconut cream","1 oz fresh pineapple juice","0.75 oz fresh lime juice","0.25 oz cinnamon syrup","1 dash Angostura bitters"],"method":"Shake all with ice. Strain over crushed ice in Collins glass.","glassware":"Collins","garnish":"Pineapple wedge, grated nutmeg, cinnamon stick"}'
WHERE name = 'The Selector' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz Belvedere vodka","0.5 oz Chambord","0.75 oz fresh lemon juice","0.5 oz simple syrup"],"method":"Shake all with ice. Double strain into chilled martini glass.","glassware":"Martini","garnish":"Lemon twist, fresh raspberry"}'
WHERE name = 'Midnight in Midtown' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- Batched signatures
UPDATE pos_menu_items SET recipe = '{"specs":["750ml bourbon","4 oz demerara syrup","20 dashes Angostura","10 dashes orange bitters"],"method":"Combine in bottle. Rest 24hr. Pour 4oz over large rock.","glassware":"Rocks","garnish":"Orange peel, cherry","shelfLife":"30+ days"}'
WHERE name = 'Batched Old Fashioned' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["375ml gin","375ml Campari","375ml sweet vermouth"],"method":"Combine in bottle. Rest 48hr. Pour 3oz over large rock.","glassware":"Rocks","garnish":"Orange peel","shelfLife":"30+ days"}'
WHERE name = 'Batched Negroni' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["750ml rye","375ml sweet vermouth","15 dashes Angostura"],"method":"Combine, rest 24hr. Pour 3oz, strain into coupe.","glassware":"Coupe","garnish":"Luxardo cherry","shelfLife":"14+ days"}'
WHERE name = 'Batched Manhattan' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["750ml blanco tequila","375ml Cointreau","12 oz fresh lime","6 oz agave nectar","6 oz water"],"method":"Combine, keep refrigerated. Pour 4oz over rocks, salt rim.","glassware":"Rocks","garnish":"Lime wheel, salt rim","shelfLife":"10-14 days"}'
WHERE name = 'Batched Margarita' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

UPDATE pos_menu_items SET recipe = '{"specs":["750ml vodka","375ml Kahlúa","12 oz espresso concentrate","4 oz vanilla syrup"],"method":"Combine, refrigerate. Shake 4oz with ice, strain into martini.","glassware":"Martini","garnish":"3 espresso beans","shelfLife":"10-14 days"}'
WHERE name = 'Batched Espresso Martini' AND category_id = 'd942aa6b-7068-4f14-b074-0dcc1e34c88f';

-- ══════════════════════════════════════════════════════════════
-- CLASSIC COCKTAILS — RECIPES
-- ══════════════════════════════════════════════════════════════

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz bourbon/rye","0.25 oz demerara syrup","2 dash Angostura","1 dash orange bitters"],"method":"Stir, strain over large rock.","glassware":"Rocks","garnish":"Orange peel, Luxardo cherry"}'
WHERE name = 'Old Fashioned' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz rye whiskey","1 oz sweet vermouth","2 dash Angostura"],"method":"Stir, strain into coupe.","glassware":"Coupe","garnish":"Luxardo cherry"}'
WHERE name = 'Manhattan' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2.5 oz gin/vodka","0.5 oz dry vermouth"],"method":"Stir (gin) or shake (vodka), strain into martini.","glassware":"Martini","garnish":"Olive or lemon twist"}'
WHERE name = 'Martini' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz blanco tequila","1 oz fresh lime","0.75 oz Cointreau","0.25 oz agave"],"method":"Shake, strain over rocks. Salt rim optional.","glassware":"Rocks","garnish":"Lime wheel, salt rim"}'
WHERE name = 'Margarita' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz white rum","1 oz fresh lime","0.75 oz simple syrup"],"method":"Shake, double strain into coupe.","glassware":"Coupe","garnish":"Lime wheel"}'
WHERE name = 'Daiquiri' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz white rum","1 oz fresh lime","0.75 oz simple syrup","8 mint leaves","Club soda top"],"method":"Muddle mint and syrup. Add rum, lime, ice. Top soda.","glassware":"Collins","garnish":"Mint bouquet, lime wheel"}'
WHERE name = 'Mojito' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz bourbon","0.75 oz fresh lemon","0.75 oz simple syrup","Egg white optional"],"method":"Dry shake (if egg white), wet shake, strain over rocks.","glassware":"Rocks","garnish":"Angostura drops, cherry"}'
WHERE name = 'Whiskey Sour' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz vodka","0.75 oz fresh espresso","0.5 oz Kahlúa","0.25 oz simple syrup"],"method":"Shake hard with ice. Double strain into martini.","glassware":"Martini","garnish":"3 espresso beans"}'
WHERE name = 'Espresso Martini' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["1 oz gin","1 oz Campari","1 oz sweet vermouth"],"method":"Stir, strain over large rock.","glassware":"Rocks","garnish":"Orange peel"}'
WHERE name = 'Negroni' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz blanco tequila","0.5 oz fresh lime","Grapefruit soda top","Pinch salt"],"method":"Build in Collins over ice. Top grapefruit soda.","glassware":"Collins","garnish":"Grapefruit wedge, salt rim"}'
WHERE name = 'Paloma' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["1 oz gin","0.75 oz fresh lemon","0.5 oz simple syrup","Champagne top"],"method":"Shake base, strain into flute, top champagne.","glassware":"Flute","garnish":"Lemon twist"}'
WHERE name = 'French 75' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz dark rum","0.5 oz fresh lime","Ginger beer top"],"method":"Build in Collins over ice. Float rum.","glassware":"Collins","garnish":"Lime wedge"}'
WHERE name = 'Dark & Stormy' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz vodka","0.5 oz fresh lime","Ginger beer top"],"method":"Build in mule mug over ice.","glassware":"Mule mug","garnish":"Lime wheel, mint sprig"}'
WHERE name = 'Moscow Mule' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz Aperol","3 oz prosecco","1 oz club soda"],"method":"Build in wine glass over ice.","glassware":"Wine glass","garnish":"Orange slice"}'
WHERE name = 'Aperol Spritz' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

UPDATE pos_menu_items SET recipe = '{"specs":["1.5 oz citrus vodka","1 oz Cointreau","0.5 oz fresh lime","1 oz cranberry juice"],"method":"Shake, double strain into martini.","glassware":"Martini","garnish":"Flamed orange peel"}'
WHERE name = 'Cosmopolitan' AND category_id = '47037cbb-cd33-41f5-98aa-d61be34e4b40';

-- ══════════════════════════════════════════════════════════════
-- ZERO PROOF — RECIPES
-- ══════════════════════════════════════════════════════════════

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz Seedlip Spice 94","1 oz passionfruit purée","0.75 oz fresh lemon juice","0.5 oz honey-ginger syrup","Top sparkling water"],"method":"Shake base with ice. Strain into Collins over ice. Top sparkling.","glassware":"Collins","garnish":"Dehydrated citrus wheel, rosemary sprig"}'
WHERE name = 'Golden Hour' AND category_id = '0767939d-b99a-4cc4-a439-b2ccfadbec37';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz Lyre''s Italian Spritz","1 oz fresh blood orange juice","Top Fever-Tree tonic","Splash cranberry"],"method":"Build in wine glass over ice. Gentle stir.","glassware":"Wine glass","garnish":"Orange wheel, fresh thyme"}'
WHERE name = 'The Muse' AND category_id = '0767939d-b99a-4cc4-a439-b2ccfadbec37';

UPDATE pos_menu_items SET recipe = '{"specs":["3 cucumber slices","4 basil leaves","1 oz elderflower tonic","0.75 oz fresh lime juice","0.5 oz agave nectar","Top sparkling water"],"method":"Muddle cucumber and basil. Add lime, agave, ice. Top sparkling and tonic.","glassware":"Collins","garnish":"Cucumber ribbon, basil leaf"}'
WHERE name = 'Velvet Garden' AND category_id = '0767939d-b99a-4cc4-a439-b2ccfadbec37';

UPDATE pos_menu_items SET recipe = '{"specs":["2 oz cold brew concentrate","0.5 oz vanilla syrup","0.25 oz chocolate syrup","Oat milk foam"],"method":"Shake cold brew, vanilla, chocolate with ice. Strain into coupe. Top oat milk foam.","glassware":"Coupe","garnish":"Cocoa powder dust, 3 coffee beans"}'
WHERE name = 'Midnight Bloom' AND category_id = '0767939d-b99a-4cc4-a439-b2ccfadbec37';
