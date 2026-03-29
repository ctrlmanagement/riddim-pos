-- Migration 010: Add acted_by audit column to pos_orders and pos_order_lines
-- Purpose: When a manager uses "Act As" mode to operate as another employee,
--          acted_by records WHO actually performed the action (the manager).
--          server_id / added_by remain the target employee for attribution.
-- Date: 2026-03-29 (S89)

ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS acted_by UUID;
ALTER TABLE pos_order_lines ADD COLUMN IF NOT EXISTS acted_by UUID;
