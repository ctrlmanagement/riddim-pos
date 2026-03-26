-- ============================================
-- RIDDIM POS — Local PostgreSQL Schema
-- Run against the riddim_pos database
-- ============================================

-- Sequential IDs for receipts (like HotSauce Order ID / Sale ID)
CREATE SEQUENCE IF NOT EXISTS pos_order_num_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS pos_sale_num_seq START 1001;

-- Orders (tabs are just orders in open/sent/held state)
CREATE TABLE IF NOT EXISTS pos_orders (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_num       integer DEFAULT nextval('pos_order_num_seq'),
    tab_name        text,                           -- "John's tab", "Bar 7", etc.
    table_num       integer,                        -- floor plan table number
    member_id       uuid,                           -- FK to Supabase members (synced)
    server_id       uuid NOT NULL,                  -- FK to Supabase staff
    server_name     text NOT NULL,                  -- denormalized for offline
    station_code    text NOT NULL,                  -- BAR1, BAR2, etc.
    state           text NOT NULL DEFAULT 'open',   -- open, sent, held, paid, closed, voided, refunded
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
    opened_at       timestamptz DEFAULT now(),
    held_at         timestamptz,
    paid_at         timestamptz,
    closed_at       timestamptz,
    synced_at       timestamptz,                    -- last sync to Supabase
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_orders_state ON pos_orders(state);
CREATE INDEX idx_orders_server ON pos_orders(server_id);
CREATE INDEX idx_orders_station ON pos_orders(station_code);
CREATE INDEX idx_orders_opened ON pos_orders(opened_at);

-- Order line items
CREATE TABLE IF NOT EXISTS pos_order_lines (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id        uuid NOT NULL REFERENCES pos_orders(id) ON DELETE CASCADE,
    menu_item_id    uuid,                           -- FK to Supabase pos_menu_items
    name            text NOT NULL,                  -- denormalized
    price           numeric(10,2) NOT NULL,
    qty             integer NOT NULL DEFAULT 1,
    seat            integer,                        -- seat number (nullable)
    state           text NOT NULL DEFAULT 'pending',-- pending, sent, preparing, ready, served, voided, comped
    inv_product_id  uuid,                           -- FK to Supabase inv_products (for COGS)
    void_reason     text,
    voided_by       uuid,
    voided_at       timestamptz,
    comp_reason     text,
    comped_by       uuid,
    comped_at       timestamptz,
    fired_at        timestamptz,
    added_by        uuid NOT NULL,
    added_at        timestamptz DEFAULT now(),
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_lines_order ON pos_order_lines(order_id);
CREATE INDEX idx_lines_state ON pos_order_lines(state);

-- Payments
CREATE TABLE IF NOT EXISTS pos_payments (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_num        integer DEFAULT nextval('pos_sale_num_seq'),
    order_id        uuid NOT NULL REFERENCES pos_orders(id) ON DELETE CASCADE,
    method          text NOT NULL,                  -- card, cash, comp
    amount          numeric(10,2) NOT NULL,
    tip_amount      numeric(10,2) DEFAULT 0,
    stripe_pi_id    text,                           -- Stripe PaymentIntent ID (card only)
    processed_by    uuid NOT NULL,                  -- staff who closed
    processed_at    timestamptz DEFAULT now(),
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_payments_order ON pos_payments(order_id);
CREATE INDEX idx_payments_method ON pos_payments(method);

-- Clock entries
CREATE TABLE IF NOT EXISTS pos_clock_entries (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id        uuid NOT NULL,
    staff_name      text NOT NULL,                  -- denormalized
    clock_in        timestamptz NOT NULL DEFAULT now(),
    clock_out       timestamptz,
    station_code    text,
    forced_out_by   uuid,                           -- if manager forced clock-out
    synced_at       timestamptz,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_clock_staff ON pos_clock_entries(staff_id);
CREATE INDEX idx_clock_date ON pos_clock_entries(clock_in);

-- Day close sessions
CREATE TABLE IF NOT EXISTS pos_sessions (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opened_at       timestamptz NOT NULL DEFAULT now(),
    closed_at       timestamptz,
    closed_by       uuid,
    total_sales     numeric(10,2) DEFAULT 0,
    total_tax       numeric(10,2) DEFAULT 0,
    total_tips      numeric(10,2) DEFAULT 0,
    total_comps     numeric(10,2) DEFAULT 0,
    total_voids     numeric(10,2) DEFAULT 0,
    order_count     integer DEFAULT 0,
    synced_at       timestamptz,
    created_at      timestamptz DEFAULT now()
);

-- Audit log (discount, price override, tip adjust, 86 toggle, tab reopen, manager override)
CREATE TABLE IF NOT EXISTS pos_audit_log (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_type      text NOT NULL,       -- discount, price_override, tip_adjust, 86_toggle, tab_reopen, manager_override
    order_id        uuid,
    line_id         uuid,
    staff_id        uuid NOT NULL,
    staff_name      text NOT NULL,
    detail          jsonb DEFAULT '{}',  -- flexible: {original_price, new_price}, {tip_before, tip_after}, etc.
    reason          text,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_type ON pos_audit_log(audit_type);
CREATE INDEX idx_audit_date ON pos_audit_log(created_at);

-- KDS routing rules (which categories go to which display)
CREATE TABLE IF NOT EXISTS pos_kds_routes (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id     uuid NOT NULL,                  -- FK to Supabase pos_menu_categories
    station         text NOT NULL,                  -- 'kitchen', 'bar', 'expo'
    display_name    text NOT NULL,                  -- shown on KDS header
    active          boolean DEFAULT true,
    created_at      timestamptz DEFAULT now()
);
