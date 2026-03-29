-- ============================================
-- RIDDIM POS — Supabase Mirror Tables
-- Run in Supabase SQL Editor (cloud)
-- These mirror the local PG tables for remote BOH access
-- ============================================

-- ── ORDERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_orders_sync (
    id              uuid PRIMARY KEY,
    order_num       integer,
    tab_name        text,
    table_num       integer,
    member_id       text,
    server_id       text,
    server_name     text NOT NULL,
    station_code    text NOT NULL,
    state           text NOT NULL DEFAULT 'open',
    customer_count  integer DEFAULT 1,
    seat_count      integer DEFAULT 0,
    subtotal        numeric(10,2) DEFAULT 0,
    discount_pct    numeric(5,4) DEFAULT 0,
    discount_flat   numeric(10,2) DEFAULT 0,
    discount_by     uuid,
    tax_amount      numeric(10,2) DEFAULT 0,
    auto_grat_pct   numeric(5,4) DEFAULT 0,
    auto_grat_amt   numeric(10,2) DEFAULT 0,
    total           numeric(10,2) DEFAULT 0,
    void_reason     text,
    voided_by       uuid,
    voided_at       timestamptz,
    opened_at       timestamptz,
    held_at         timestamptz,
    paid_at         timestamptz,
    closed_at       timestamptz,
    booking_id      uuid,
    session_id      uuid,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    synced_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_orders_sync_state ON pos_orders_sync(state);
CREATE INDEX IF NOT EXISTS idx_pos_orders_sync_opened ON pos_orders_sync(opened_at);
CREATE INDEX IF NOT EXISTS idx_pos_orders_sync_server ON pos_orders_sync(server_id);

-- ── ORDER LINES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_order_lines_sync (
    id              uuid PRIMARY KEY,
    order_id        uuid NOT NULL REFERENCES pos_orders_sync(id) ON DELETE CASCADE,
    menu_item_id    uuid,
    name            text NOT NULL,
    price           numeric(10,2) NOT NULL,
    qty             integer NOT NULL DEFAULT 1,
    seat            integer,
    state           text NOT NULL DEFAULT 'pending',
    inv_product_id  uuid,
    void_reason     text,
    voided_by       uuid,
    voided_at       timestamptz,
    comp_reason     text,
    comped_by       uuid,
    comped_at       timestamptz,
    fired_at        timestamptz,
    modifiers       jsonb DEFAULT '[]',
    added_by        uuid NOT NULL,
    added_at        timestamptz,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_lines_sync_order ON pos_order_lines_sync(order_id);

-- ── PAYMENTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_payments_sync (
    id              uuid PRIMARY KEY,
    sale_num        integer,
    order_id        uuid NOT NULL REFERENCES pos_orders_sync(id) ON DELETE CASCADE,
    method          text NOT NULL,
    amount          numeric(10,2) NOT NULL,
    tip_amount      numeric(10,2) DEFAULT 0,
    stripe_pi_id    text,
    processed_by    uuid NOT NULL,
    processed_at    timestamptz,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_payments_sync_order ON pos_payments_sync(order_id);

-- ── CLOCK ENTRIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_clock_entries_sync (
    id              uuid PRIMARY KEY,
    staff_id        text NOT NULL,
    staff_name      text NOT NULL,
    clock_in        timestamptz NOT NULL,
    clock_out       timestamptz,
    station_code    text,
    forced_out_by   uuid,
    created_at      timestamptz DEFAULT now(),
    synced_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_clock_sync_staff ON pos_clock_entries_sync(staff_id);
CREATE INDEX IF NOT EXISTS idx_pos_clock_sync_date ON pos_clock_entries_sync(clock_in);

-- ── AUDIT LOG ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_audit_log_sync (
    id              uuid PRIMARY KEY,
    audit_type      text NOT NULL,
    order_id        uuid,
    line_id         uuid,
    staff_id        uuid NOT NULL,
    staff_name      text NOT NULL,
    detail          jsonb DEFAULT '{}',
    reason          text,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_audit_sync_type ON pos_audit_log_sync(audit_type);
CREATE INDEX IF NOT EXISTS idx_pos_audit_sync_date ON pos_audit_log_sync(created_at);

-- ── DAY CLOSE SESSIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_sessions_sync (
    id              uuid PRIMARY KEY,
    opened_at       timestamptz NOT NULL,
    closed_at       timestamptz,
    closed_by       uuid,
    total_sales     numeric(10,2) DEFAULT 0,
    total_tax       numeric(10,2) DEFAULT 0,
    total_tips      numeric(10,2) DEFAULT 0,
    total_comps     numeric(10,2) DEFAULT 0,
    total_voids     numeric(10,2) DEFAULT 0,
    order_count     integer DEFAULT 0,
    created_at      timestamptz DEFAULT now(),
    synced_at       timestamptz DEFAULT now()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
-- All sync tables: read access via publishable key (BOH portal reads),
-- write access restricted to service role (server sync daemon).
-- The publishable key used by the terminal/BOH portal can SELECT but not modify.

ALTER TABLE pos_orders_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_order_lines_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_payments_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_clock_entries_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_audit_log_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sessions_sync ENABLE ROW LEVEL SECURITY;

-- Read policies (anon/authenticated can read for BOH portal)
CREATE POLICY "pos_orders_sync_read" ON pos_orders_sync FOR SELECT USING (true);
CREATE POLICY "pos_order_lines_sync_read" ON pos_order_lines_sync FOR SELECT USING (true);
CREATE POLICY "pos_payments_sync_read" ON pos_payments_sync FOR SELECT USING (true);
CREATE POLICY "pos_clock_entries_sync_read" ON pos_clock_entries_sync FOR SELECT USING (true);
CREATE POLICY "pos_audit_log_sync_read" ON pos_audit_log_sync FOR SELECT USING (true);
CREATE POLICY "pos_sessions_sync_read" ON pos_sessions_sync FOR SELECT USING (true);

-- Write policies (only service_role can insert/update — used by server sync daemon)
CREATE POLICY "pos_orders_sync_write" ON pos_orders_sync FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "pos_order_lines_sync_write" ON pos_order_lines_sync FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "pos_payments_sync_write" ON pos_payments_sync FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "pos_clock_entries_sync_write" ON pos_clock_entries_sync FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "pos_audit_log_sync_write" ON pos_audit_log_sync FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "pos_sessions_sync_write" ON pos_sessions_sync FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
