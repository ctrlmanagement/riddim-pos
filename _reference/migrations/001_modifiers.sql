-- ============================================
-- RIDDIM POS — Modifier System Migration
-- Run in Supabase SQL Editor (cloud)
-- Session 89 — Bar Builders Phase 2
-- ============================================

-- ── MODIFIER GROUPS ─────────────────────────────────────────
-- Groups: ice, mix, garnish, prep
CREATE TABLE IF NOT EXISTS pos_modifier_groups (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name        text NOT NULL,               -- 'Ice', 'Mix', 'Garnish', 'Prep'
    sort_order  integer NOT NULL DEFAULT 0,
    active      boolean DEFAULT true,
    created_at  timestamptz DEFAULT now()
);

-- ── MODIFIERS ───────────────────────────────────────────────
-- Individual options within a group
CREATE TABLE IF NOT EXISTS pos_modifiers (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id    uuid NOT NULL REFERENCES pos_modifier_groups(id) ON DELETE CASCADE,
    name        text NOT NULL,               -- 'Neat', 'Rocks', 'Up', etc.
    sort_order  integer NOT NULL DEFAULT 0,
    active      boolean DEFAULT true,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_modifiers_group ON pos_modifiers(group_id);

-- ── ADD modifiers COLUMN TO ORDER LINES ─────────────────────
-- Denormalized JSON array of modifier names for offline/receipt use
-- e.g. ["Neat", "No Garnish"]
-- pos_order_lines is local PG only — run ALTER there separately
-- Only the sync table exists in Supabase
ALTER TABLE pos_order_lines_sync ADD COLUMN IF NOT EXISTS modifiers jsonb DEFAULT '[]';

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE pos_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_modifiers ENABLE ROW LEVEL SECURITY;

-- Read access (anon — terminal loads at startup)
CREATE POLICY "pos_modifier_groups_read" ON pos_modifier_groups FOR SELECT USING (true);
CREATE POLICY "pos_modifiers_read" ON pos_modifiers FOR SELECT USING (true);

-- Write access (service_role only — management CRUD)
CREATE POLICY "pos_modifier_groups_write" ON pos_modifier_groups FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "pos_modifiers_write" ON pos_modifiers FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ── SEED DATA ───────────────────────────────────────────────
-- 4 groups, 19 modifiers (from Bar Builders S87)

INSERT INTO pos_modifier_groups (name, sort_order) VALUES
  ('Ice',     1),
  ('Mix',     2),
  ('Garnish', 3),
  ('Prep',    4);

-- Ice modifiers
INSERT INTO pos_modifiers (group_id, name, sort_order)
SELECT g.id, m.name, m.ord
FROM pos_modifier_groups g,
     (VALUES ('Neat',1), ('Rocks',2), ('Up',3), ('Sphere',4), ('Crushed',5)) AS m(name, ord)
WHERE g.name = 'Ice';

-- Mix modifiers
INSERT INTO pos_modifiers (group_id, name, sort_order)
SELECT g.id, m.name, m.ord
FROM pos_modifier_groups g,
     (VALUES ('Tall',1), ('Splash',2), ('Dirty',3), ('Extra Dry',4), ('Double',5)) AS m(name, ord)
WHERE g.name = 'Mix';

-- Garnish modifiers
INSERT INTO pos_modifiers (group_id, name, sort_order)
SELECT g.id, m.name, m.ord
FROM pos_modifier_groups g,
     (VALUES ('No Garnish',1), ('Extra Garnish',2), ('Salt Rim',3), ('Sugar Rim',4), ('Tajín Rim',5)) AS m(name, ord)
WHERE g.name = 'Garnish';

-- Prep modifiers
INSERT INTO pos_modifiers (group_id, name, sort_order)
SELECT g.id, m.name, m.ord
FROM pos_modifier_groups g,
     (VALUES ('Shaken',1), ('Stirred',2), ('Muddled',3), ('Blended',4)) AS m(name, ord)
WHERE g.name = 'Prep';
