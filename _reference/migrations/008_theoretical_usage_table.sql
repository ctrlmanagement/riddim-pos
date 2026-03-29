-- ============================================
-- RIDDIM POS — P1: Theoretical Usage Table
-- Run in Supabase SQL Editor (cloud)
-- Session 90 — POS sales → theoretical inventory consumption
-- ============================================

-- ══════════════════════════════════════════════════════════════
-- pos_theoretical_usage
-- Written at day close by POS server. One row per product per
-- station per day. Owner portal compares against physical counts.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pos_theoretical_usage (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_date date NOT NULL,
  inv_product_id uuid NOT NULL REFERENCES inv_products(id),
  station_code  text NOT NULL,          -- BAR1, BAR2, BAR5/SVC, etc.
  pour_qty      integer DEFAULT 0,      -- number of spirit pours (non-bottle)
  pour_oz       numeric(10,2) DEFAULT 0,-- total oz consumed (pour_qty × std_pour_oz)
  bottle_qty    integer DEFAULT 0,      -- number of bottles sold (BTL SVC)
  std_pour_oz   numeric(10,2) DEFAULT 2,-- snapshot of product's std_pour_oz at close time
  created_at    timestamptz DEFAULT now(),
  UNIQUE (business_date, inv_product_id, station_code)
);

-- RLS: anon can SELECT (same pattern as other POS tables)
ALTER TABLE pos_theoretical_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_theoretical_usage_select" ON pos_theoretical_usage
  FOR SELECT USING (true);

CREATE POLICY "pos_theoretical_usage_insert" ON pos_theoretical_usage
  FOR INSERT WITH CHECK (true);

CREATE POLICY "pos_theoretical_usage_update" ON pos_theoretical_usage
  FOR UPDATE USING (true);

-- Index for owner portal queries (date range + product)
CREATE INDEX idx_theoretical_usage_date ON pos_theoretical_usage (business_date);
CREATE INDEX idx_theoretical_usage_product ON pos_theoretical_usage (inv_product_id, business_date);


-- ══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════════

SELECT tablename FROM pg_tables WHERE tablename = 'pos_theoretical_usage';
