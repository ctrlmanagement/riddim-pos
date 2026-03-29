-- ============================================
-- RIDDIM POS — Modifier Upcharges (Spirit Upgrades)
-- Run in Supabase SQL Editor (cloud)
-- Session 89 — Bar Builders Phase 2
-- ============================================

-- ── ADD price COLUMN TO MODIFIERS ───────────────────────────
-- Default 0 = no upcharge (Neat, Rocks, etc.)
-- Positive value = upcharge (spirit upgrades)
ALTER TABLE pos_modifiers ADD COLUMN IF NOT EXISTS price numeric(10,2) DEFAULT 0;

-- ── SPIRIT UPGRADE GROUP ────────────────────────────────────
INSERT INTO pos_modifier_groups (name, sort_order) VALUES ('Spirit', 5);

-- ── SPIRIT UPGRADE OPTIONS ──────────────────────────────────
-- Premium spirit swaps with upcharge over house pour
INSERT INTO pos_modifiers (group_id, name, sort_order, price)
SELECT g.id, m.name, m.ord, m.price
FROM pos_modifier_groups g,
     (VALUES
       ('Don Julio 1942',    1,  12),
       ('Clase Azul Repo',   2,  10),
       ('Casamigos Repo',    3,  5),
       ('Casamigos Blanco',  4,  4),
       ('Hennessy VSOP',     5,  5),
       ('D''Ussé VSOP',      6,  5),
       ('Grey Goose',        7,  4),
       ('Belvedere',         8,  4),
       ('Woodford Reserve',  9,  4),
       ('Macallan 12',       10, 6),
       ('Patron Silver',     11, 5),
       ('Johnnie Walker Black', 12, 5)
     ) AS m(name, ord, price)
WHERE g.name = 'Spirit';
