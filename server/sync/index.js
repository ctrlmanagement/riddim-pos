/**
 * RIDDIM POS — Supabase Sync Daemon
 * Pushes local PG data → Supabase cloud on an interval.
 * Only syncs rows where synced_at IS NULL (new/updated since last sync).
 * Stamps synced_at on success. Skips on failure (retries next cycle).
 */

const pool = require('../db/pool');
const { supabaseAdmin } = require('../db/supabase');

const SYNC_INTERVAL = 30_000; // 30 seconds
const BATCH_SIZE = 50;

let syncTimer = null;
let syncing = false;

// Track stats for /api/sync/status
const stats = {
  lastSyncAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  totalSynced: 0,
  totalErrors: 0,
  pending: { orders: 0, lines: 0, payments: 0, clock: 0, audit: 0, paid_outs: 0, sessions: 0 },
};

// ── SYNC ORDERS ──────────────────────────────────────────────
async function syncOrders() {
  const { rows } = await pool.query(
    `SELECT * FROM pos_orders WHERE synced_at IS NULL ORDER BY created_at LIMIT $1`,
    [BATCH_SIZE]
  );
  if (!rows.length) return 0;

  const { error } = await supabaseAdmin
    .from('pos_orders_sync')
    .upsert(rows.map(r => ({
      id: r.id,
      order_num: r.order_num,
      tab_name: r.tab_name,
      table_num: r.table_num,
      member_id: r.member_id,
      server_id: r.server_id,
      server_name: r.server_name,
      station_code: r.station_code,
      state: r.state,
      customer_count: r.customer_count,
      seat_count: r.seat_count,
      subtotal: r.subtotal,
      discount_pct: r.discount_pct,
      discount_flat: r.discount_flat,
      discount_by: r.discount_by,
      tax_amount: r.tax_amount,
      auto_grat_pct: r.auto_grat_pct,
      auto_grat_amt: r.auto_grat_amt,
      total: r.total,
      void_reason: r.void_reason,
      voided_by: r.voided_by,
      voided_at: r.voided_at,
      opened_at: r.opened_at,
      held_at: r.held_at,
      paid_at: r.paid_at,
      closed_at: r.closed_at,
      booking_id: r.booking_id,
      session_id: r.session_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      synced_at: new Date().toISOString(),
    })), { onConflict: 'id' });

  if (error) throw new Error(`orders: ${error.message}`);

  const ids = rows.map(r => r.id);
  await pool.query(
    `UPDATE pos_orders SET synced_at = now() WHERE id = ANY($1)`,
    [ids]
  );
  return rows.length;
}

// ── SYNC ORDER LINES ─────────────────────────────────────────
async function syncOrderLines() {
  // Sync lines for orders synced in the last 2 minutes (catches newly-synced orders
  // then stops re-pushing). Upsert is idempotent via ON CONFLICT id.
  const { rows: lines } = await pool.query(
    `SELECT l.* FROM pos_order_lines l
     JOIN pos_orders o ON o.id = l.order_id
     WHERE o.synced_at IS NOT NULL
       AND o.synced_at > now() - interval '2 minutes'
     ORDER BY l.created_at LIMIT $1`,
    [BATCH_SIZE]
  );
  if (!lines.length) return 0;

  const { error } = await supabaseAdmin
    .from('pos_order_lines_sync')
    .upsert(lines.map(r => ({
      id: r.id,
      order_id: r.order_id,
      menu_item_id: r.menu_item_id,
      name: r.name,
      price: r.price,
      qty: r.qty,
      seat: r.seat,
      state: r.state,
      inv_product_id: r.inv_product_id,
      void_reason: r.void_reason,
      voided_by: r.voided_by,
      voided_at: r.voided_at,
      comp_reason: r.comp_reason,
      comped_by: r.comped_by,
      comped_at: r.comped_at,
      fired_at: r.fired_at,
      modifiers: r.modifiers || [],
      added_by: r.added_by,
      added_at: r.added_at,
      created_at: r.created_at,
    })), { onConflict: 'id' });

  if (error) throw new Error(`order_lines: ${error.message}`);
  return lines.length;
}

// ── SYNC PAYMENTS ────────────────────────────────────────────
async function syncPayments() {
  // Only sync payments for orders synced in the last 2 minutes
  const { rows } = await pool.query(
    `SELECT p.* FROM pos_payments p
     JOIN pos_orders o ON o.id = p.order_id
     WHERE o.synced_at IS NOT NULL
       AND o.synced_at > now() - interval '2 minutes'
     ORDER BY p.created_at LIMIT $1`,
    [BATCH_SIZE]
  );
  if (!rows.length) return 0;

  const { error } = await supabaseAdmin
    .from('pos_payments_sync')
    .upsert(rows.map(r => ({
      id: r.id,
      sale_num: r.sale_num,
      order_id: r.order_id,
      method: r.method,
      amount: r.amount,
      tip_amount: r.tip_amount,
      stripe_pi_id: r.stripe_pi_id,
      processed_by: r.processed_by,
      processed_at: r.processed_at,
      created_at: r.created_at,
    })), { onConflict: 'id' });

  if (error) throw new Error(`payments: ${error.message}`);
  return rows.length;
}

// ── SYNC CLOCK ENTRIES ───────────────────────────────────────
async function syncClock() {
  const { rows } = await pool.query(
    `SELECT * FROM pos_clock_entries WHERE synced_at IS NULL ORDER BY created_at LIMIT $1`,
    [BATCH_SIZE]
  );
  if (!rows.length) return 0;

  const { error } = await supabaseAdmin
    .from('pos_clock_entries_sync')
    .upsert(rows.map(r => ({
      id: r.id,
      staff_id: r.staff_id,
      staff_name: r.staff_name,
      clock_in: r.clock_in,
      clock_out: r.clock_out,
      station_code: r.station_code,
      forced_out_by: r.forced_out_by,
      created_at: r.created_at,
      synced_at: new Date().toISOString(),
    })), { onConflict: 'id' });

  if (error) throw new Error(`clock: ${error.message}`);

  const ids = rows.map(r => r.id);
  await pool.query(
    `UPDATE pos_clock_entries SET synced_at = now() WHERE id = ANY($1)`,
    [ids]
  );
  return rows.length;
}

// ── SYNC AUDIT LOG ───────────────────────────────────────────
async function syncAudit() {
  // Audit log has no synced_at — upsert recent entries (last 24h)
  const { rows } = await pool.query(
    `SELECT * FROM pos_audit_log
     WHERE created_at > now() - interval '24 hours'
     ORDER BY created_at LIMIT $1`,
    [BATCH_SIZE]
  );
  if (!rows.length) return 0;

  const { error } = await supabaseAdmin
    .from('pos_audit_log_sync')
    .upsert(rows.map(r => ({
      id: r.id,
      audit_type: r.audit_type,
      order_id: r.order_id,
      line_id: r.line_id,
      staff_id: r.staff_id,
      staff_name: r.staff_name,
      detail: r.detail,
      reason: r.reason,
      created_at: r.created_at,
    })), { onConflict: 'id' });

  if (error) throw new Error(`audit: ${error.message}`);
  return rows.length;
}

// ── SYNC PAID OUTS ──────────────────────────────────────────
async function syncPaidOuts() {
  const { rows } = await pool.query(
    `SELECT * FROM pos_paid_outs WHERE synced_at IS NULL ORDER BY created_at LIMIT $1`,
    [BATCH_SIZE]
  );
  if (!rows.length) return 0;

  const { error } = await supabaseAdmin
    .from('pos_paid_outs_sync')
    .upsert(rows.map(r => ({
      id: r.id,
      session_id: r.session_id,
      category: r.category,
      amount: r.amount,
      notes: r.notes,
      staff_id: r.staff_id,
      staff_name: r.staff_name,
      station_code: r.station_code,
      recorded_at: r.recorded_at,
      created_at: r.created_at,
      synced_at: new Date().toISOString(),
    })), { onConflict: 'id' });

  if (error) throw new Error(`paid_outs: ${error.message}`);

  const ids = rows.map(r => r.id);
  await pool.query(
    `UPDATE pos_paid_outs SET synced_at = now() WHERE id = ANY($1)`,
    [ids]
  );
  return rows.length;
}

// ── SYNC SESSIONS ────────────────────────────────────────────
async function syncSessions() {
  const { rows } = await pool.query(
    `SELECT * FROM pos_sessions WHERE synced_at IS NULL ORDER BY created_at LIMIT $1`,
    [BATCH_SIZE]
  );
  if (!rows.length) return 0;

  const { error } = await supabaseAdmin
    .from('pos_sessions_sync')
    .upsert(rows.map(r => ({
      id: r.id,
      opened_at: r.opened_at,
      closed_at: r.closed_at,
      closed_by: r.closed_by,
      total_sales: r.total_sales,
      total_tax: r.total_tax,
      total_tips: r.total_tips,
      total_comps: r.total_comps,
      total_voids: r.total_voids,
      order_count: r.order_count,
      created_at: r.created_at,
      synced_at: new Date().toISOString(),
    })), { onConflict: 'id' });

  if (error) throw new Error(`sessions: ${error.message}`);

  const ids = rows.map(r => r.id);
  await pool.query(
    `UPDATE pos_sessions SET synced_at = now() WHERE id = ANY($1)`,
    [ids]
  );
  return rows.length;
}

// ── PENDING COUNTS ───────────────────────────────────────────
async function updatePendingCounts() {
  const queries = [
    pool.query(`SELECT COUNT(*) FROM pos_orders WHERE synced_at IS NULL`),
    pool.query(`SELECT COUNT(*) FROM pos_order_lines l JOIN pos_orders o ON o.id = l.order_id WHERE o.synced_at IS NULL`),
    pool.query(`SELECT COUNT(*) FROM pos_payments p JOIN pos_orders o ON o.id = p.order_id WHERE o.synced_at IS NULL`),
    pool.query(`SELECT COUNT(*) FROM pos_clock_entries WHERE synced_at IS NULL`),
    pool.query(`SELECT COUNT(*) FROM pos_audit_log WHERE created_at > now() - interval '24 hours'`),
    pool.query(`SELECT COUNT(*) FROM pos_paid_outs WHERE synced_at IS NULL`),
    pool.query(`SELECT COUNT(*) FROM pos_sessions WHERE synced_at IS NULL`),
  ];
  const [orders, lines, payments, clock, audit, paid_outs, sessions] = await Promise.all(queries);
  stats.pending = {
    orders: parseInt(orders.rows[0].count),
    lines: parseInt(lines.rows[0].count),
    payments: parseInt(payments.rows[0].count),
    clock: parseInt(clock.rows[0].count),
    audit: parseInt(audit.rows[0].count),
    paid_outs: parseInt(paid_outs.rows[0].count),
    sessions: parseInt(sessions.rows[0].count),
  };
}

// ── MAIN SYNC CYCLE ──────────────────────────────────────────
async function runSync() {
  if (syncing) return;
  syncing = true;
  stats.lastSyncAt = new Date().toISOString();

  try {
    let total = 0;
    total += await syncOrders();
    total += await syncOrderLines();
    total += await syncPayments();
    total += await syncClock();
    total += await syncAudit();
    total += await syncPaidOuts();
    total += await syncSessions();

    stats.totalSynced += total;
    if (total > 0) {
      stats.lastSuccessAt = new Date().toISOString();
      console.log(`[sync] pushed ${total} rows to Supabase`);
    }

    await updatePendingCounts();
  } catch (err) {
    stats.totalErrors++;
    stats.lastErrorAt = new Date().toISOString();
    stats.lastError = err.message;
    console.error(`[sync] error:`, err.message);
  } finally {
    syncing = false;
  }
}

// ── START / STOP ─────────────────────────────────────────────
function start() {
  if (!supabaseAdmin) {
    console.log('[sync] SUPABASE_SERVICE_KEY not set — sync disabled');
    return;
  }
  console.log(`[sync] daemon started (every ${SYNC_INTERVAL / 1000}s)`);
  // Run immediately on start, then on interval
  runSync();
  syncTimer = setInterval(runSync, SYNC_INTERVAL);
}

function stop() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[sync] daemon stopped');
  }
}

function getStats() {
  return { ...stats, enabled: !!supabaseAdmin, interval: SYNC_INTERVAL };
}

module.exports = { start, stop, getStats, runSync };
