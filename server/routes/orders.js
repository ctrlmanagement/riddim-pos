const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// ── GET all open orders (tabs) ──────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { state, server_id, station } = req.query;
    let query = 'SELECT * FROM pos_orders';
    const conditions = [];
    const params = [];

    if (state) {
      params.push(state);
      conditions.push(`state = $${params.length}`);
    }
    if (server_id) {
      params.push(server_id);
      conditions.push(`server_id = $${params.length}`);
    }
    if (station) {
      params.push(station);
      conditions.push(`station_code = $${params.length}`);
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY opened_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET single order with lines and payments ────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orderRes = await pool.query('SELECT * FROM pos_orders WHERE id = $1', [id]);
    if (!orderRes.rows.length) return res.status(404).json({ error: 'Order not found' });

    const linesRes = await pool.query('SELECT * FROM pos_order_lines WHERE order_id = $1 ORDER BY added_at', [id]);
    const paymentsRes = await pool.query('SELECT * FROM pos_payments WHERE order_id = $1 ORDER BY processed_at', [id]);

    res.json({
      ...orderRes.rows[0],
      lines: linesRes.rows,
      payments: paymentsRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE order (open tab) ─────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { tab_name, table_num, member_id, server_id, server_name, station_code, customer_count } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO pos_orders (tab_name, table_num, member_id, server_id, server_name, station_code, customer_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tab_name, table_num || null, member_id || null, server_id, server_name, station_code, customer_count || 1]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD line items to order ─────────────────────────────────
router.post('/:id/lines', async (req, res) => {
  try {
    const { id } = req.params;
    const { lines } = req.body; // array of { menu_item_id, name, price, qty, seat, inv_product_id, added_by }

    if (!Array.isArray(lines) || !lines.length) {
      return res.status(400).json({ error: 'lines array required' });
    }

    const inserted = [];
    for (const line of lines) {
      const { rows } = await pool.query(
        `INSERT INTO pos_order_lines (order_id, menu_item_id, name, price, qty, seat, inv_product_id, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [id, line.menu_item_id, line.name, line.price, line.qty || 1, line.seat || null, line.inv_product_id || null, line.added_by]
      );
      inserted.push(rows[0]);
    }

    // Recalculate order totals
    await recalcOrder(id);

    res.status(201).json(inserted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── FIRE order (send to KDS) ────────────────────────────────
router.post('/:id/fire', async (req, res) => {
  try {
    const { id } = req.params;

    // Update pending lines to sent
    await pool.query(
      `UPDATE pos_order_lines SET state = 'sent', fired_at = now() WHERE order_id = $1 AND state = 'pending'`,
      [id]
    );

    // Update order state
    await pool.query(
      `UPDATE pos_orders SET state = 'sent', updated_at = now() WHERE id = $1 AND state = 'open'`,
      [id]
    );

    const order = await getOrderWithLines(id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VOID line ───────────────────────────────────────────────
router.post('/:id/lines/:lineId/void', async (req, res) => {
  try {
    const { id, lineId } = req.params;
    const { reason, voided_by } = req.body;

    await pool.query(
      `UPDATE pos_order_lines SET state = 'voided', void_reason = $1, voided_by = $2, voided_at = now() WHERE id = $3 AND order_id = $4`,
      [reason, voided_by, lineId, id]
    );

    await recalcOrder(id);
    const order = await getOrderWithLines(id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── COMP line ───────────────────────────────────────────────
router.post('/:id/lines/:lineId/comp', async (req, res) => {
  try {
    const { id, lineId } = req.params;
    const { reason, comped_by } = req.body;

    await pool.query(
      `UPDATE pos_order_lines SET state = 'comped', comp_reason = $1, comped_by = $2, comped_at = now() WHERE id = $3 AND order_id = $4`,
      [reason, comped_by, lineId, id]
    );

    await recalcOrder(id);
    const order = await getOrderWithLines(id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VOID entire order ───────────────────────────────────────
router.post('/:id/void', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, voided_by } = req.body;

    await pool.query(
      `UPDATE pos_orders SET state = 'voided', void_reason = $2, voided_by = $3, voided_at = now(), updated_at = now() WHERE id = $1`,
      [id, reason, voided_by]
    );

    await pool.query(
      `UPDATE pos_order_lines SET state = 'voided', void_reason = $1, voided_by = $2, voided_at = now() WHERE order_id = $3`,
      [reason, voided_by, id]
    );

    const order = await getOrderWithLines(id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PAY order ───────────────────────────────────────────────
router.post('/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { method, amount, tip_amount, stripe_pi_id, processed_by } = req.body;

    await pool.query(
      `INSERT INTO pos_payments (order_id, method, amount, tip_amount, stripe_pi_id, processed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, method, amount, tip_amount || 0, stripe_pi_id || null, processed_by]
    );

    await pool.query(
      `UPDATE pos_orders SET state = 'paid', paid_at = now(), updated_at = now() WHERE id = $1`,
      [id]
    );

    const order = await getOrderWithLines(id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HOLD tab ────────────────────────────────────────────────
router.post('/:id/hold', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE pos_orders SET state = 'held', held_at = now(), updated_at = now() WHERE id = $1`,
      [id]
    );
    const order = await getOrderWithLines(id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HELPERS ─────────────────────────────────────────────────
async function recalcOrder(orderId) {
  const { rows: lines } = await pool.query(
    `SELECT price, qty, state FROM pos_order_lines WHERE order_id = $1`,
    [orderId]
  );

  const subtotal = lines
    .filter(l => l.state !== 'voided' && l.state !== 'comped')
    .reduce((sum, l) => sum + parseFloat(l.price) * l.qty, 0);

  // Get order's discount info
  const { rows: [order] } = await pool.query(
    `SELECT discount_pct, discount_flat, auto_grat_pct FROM pos_orders WHERE id = $1`,
    [orderId]
  );

  const discPct = parseFloat(order.discount_pct) || 0;
  const discFlat = parseFloat(order.discount_flat) || 0;
  const discountAmt = discPct ? subtotal * discPct : Math.min(discFlat, subtotal);
  const afterDiscount = subtotal - discountAmt;

  // TODO: get tax rate from config sync — hardcode 8.9% for now
  const taxRate = 0.089;
  const taxAmount = afterDiscount * taxRate;

  const gratPct = parseFloat(order.auto_grat_pct) || 0;
  const gratAmt = gratPct ? afterDiscount * gratPct : 0;

  const total = afterDiscount + taxAmount + gratAmt;

  await pool.query(
    `UPDATE pos_orders SET subtotal = $2, tax_amount = $3, auto_grat_amt = $4, total = $5, updated_at = now() WHERE id = $1`,
    [orderId, subtotal.toFixed(2), taxAmount.toFixed(2), gratAmt.toFixed(2), total.toFixed(2)]
  );
}

async function getOrderWithLines(orderId) {
  const orderRes = await pool.query('SELECT * FROM pos_orders WHERE id = $1', [orderId]);
  const linesRes = await pool.query('SELECT * FROM pos_order_lines WHERE order_id = $1 ORDER BY added_at', [orderId]);
  const paymentsRes = await pool.query('SELECT * FROM pos_payments WHERE order_id = $1 ORDER BY processed_at', [orderId]);
  return {
    ...orderRes.rows[0],
    lines: linesRes.rows,
    payments: paymentsRes.rows,
  };
}

module.exports = router;
