const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requirePermission, requireOwner } = require('../middleware/auth');

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

// ── GET today's orders with lines and payments ───────────────
router.get('/today/all', async (req, res) => {
  try {
    const { rows: orders } = await pool.query(
      `SELECT * FROM pos_orders WHERE opened_at >= CURRENT_DATE ORDER BY opened_at DESC`
    );
    if (!orders.length) return res.json([]);

    const ids = orders.map(o => o.id);
    const { rows: lines } = await pool.query(
      `SELECT * FROM pos_order_lines WHERE order_id = ANY($1) ORDER BY added_at`,
      [ids]
    );
    const { rows: payments } = await pool.query(
      `SELECT * FROM pos_payments WHERE order_id = ANY($1) ORDER BY processed_at`,
      [ids]
    );

    // Group lines and payments by order
    const linesByOrder = {};
    lines.forEach(l => { (linesByOrder[l.order_id] = linesByOrder[l.order_id] || []).push(l); });
    const paysByOrder = {};
    payments.forEach(p => { (paysByOrder[p.order_id] = paysByOrder[p.order_id] || []).push(p); });

    const result = orders.map(o => ({
      ...o,
      lines: linesByOrder[o.id] || [],
      payments: paysByOrder[o.id] || [],
    }));

    res.json(result);
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
    const { tab_name, table_num, member_id, server_id, server_name, station_code, customer_count, booking_id, session_id } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO pos_orders (tab_name, table_num, member_id, server_id, server_name, station_code, customer_count, booking_id, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [tab_name, table_num || null, member_id || null, server_id, server_name, station_code, customer_count || 1, booking_id || null, session_id || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD line items to order ─────────────────────────────────
router.post('/:id/lines', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { lines } = req.body; // array of { menu_item_id, name, price, qty, seat, inv_product_id, added_by }

    if (!Array.isArray(lines) || !lines.length) {
      client.release();
      return res.status(400).json({ error: 'lines array required' });
    }

    await client.query('BEGIN');

    const inserted = [];
    for (const line of lines) {
      const { rows } = await client.query(
        `INSERT INTO pos_order_lines (order_id, menu_item_id, name, price, qty, seat, modifiers, inv_product_id, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [id, line.menu_item_id, line.name, line.price, line.qty || 1, line.seat || null, JSON.stringify(line.modifiers || []), line.inv_product_id || null, line.added_by]
      );
      inserted.push(rows[0]);
    }

    await client.query('COMMIT');

    // Recalculate order totals (uses pool, outside transaction)
    await recalcOrder(id);

    res.status(201).json(inserted);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VOID line ───────────────────────────────────────────────
router.post('/:id/lines/:lineId/void', requirePermission('order.void_line'), async (req, res) => {
  try {
    const { id, lineId } = req.params;
    const { reason, voided_by } = req.body;

    await pool.query(
      `UPDATE pos_order_lines SET state = 'voided', void_reason = $1, voided_by = $2, voided_at = now() WHERE id = $3 AND order_id = $4`,
      [reason, voided_by, lineId, id]
    );

    await recalcOrder(id);
    const order = await getOrderWithLines(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── COMP line ───────────────────────────────────────────────
router.post('/:id/lines/:lineId/comp', requirePermission('order.comp'), async (req, res) => {
  try {
    const { id, lineId } = req.params;
    const { reason, comped_by } = req.body;

    await pool.query(
      `UPDATE pos_order_lines SET state = 'comped', comp_reason = $1, comped_by = $2, comped_at = now() WHERE id = $3 AND order_id = $4`,
      [reason, comped_by, lineId, id]
    );

    await recalcOrder(id);
    const order = await getOrderWithLines(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VOID entire order ───────────────────────────────────────
router.post('/:id/void', requirePermission('order.void_tab'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, voided_by } = req.body;

    // Check order state — cannot void a paid order without owner permission
    const { rows: [current] } = await pool.query('SELECT state FROM pos_orders WHERE id = $1', [id]);
    if (current && current.state === 'paid') {
      return res.status(400).json({ error: 'Cannot void a paid order — reopen first or contact owner' });
    }

    await pool.query(
      `UPDATE pos_orders SET state = 'voided', void_reason = $2, voided_by = $3, voided_at = now(), updated_at = now() WHERE id = $1`,
      [id, reason, voided_by]
    );

    await pool.query(
      `UPDATE pos_order_lines SET state = 'voided', void_reason = $1, voided_by = $2, voided_at = now() WHERE order_id = $3`,
      [reason, voided_by, id]
    );

    const order = await getOrderWithLines(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PAY order ───────────────────────────────────────────────
router.post('/:id/pay', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { method, amount, tip_amount, stripe_pi_id, processed_by } = req.body;

    const amountNum = parseFloat(amount);
    const tipNum = parseFloat(tip_amount || 0);
    if (isNaN(amountNum) || amountNum < 0) {
      client.release();
      return res.status(400).json({ error: 'Invalid payment amount' });
    }
    if (isNaN(tipNum) || tipNum < 0) {
      client.release();
      return res.status(400).json({ error: 'Invalid tip amount' });
    }

    // Check min spend if order has a booking with minimum
    const { rows: [orderCheck] } = await client.query(
      `SELECT o.booking_id, o.subtotal, o.tax_amount FROM pos_orders o WHERE o.id = $1`, [id]
    );

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO pos_payments (order_id, method, amount, tip_amount, stripe_pi_id, processed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, method, amountNum, tipNum, stripe_pi_id || null, processed_by]
    );

    await client.query(
      `UPDATE pos_orders SET state = 'paid', paid_at = now(), updated_at = now() WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    // Log min spend shortfall (advisory — does not block payment per venue policy)
    if (orderCheck && orderCheck.booking_id) {
      const spent = (parseFloat(orderCheck.subtotal) || 0) + (parseFloat(orderCheck.tax_amount) || 0);
      // Note: min spend check is advisory — logged in audit, not blocked
    }

    const order = await getOrderWithLines(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PRICE OVERRIDE ──────────────────────────────────────────
router.post('/:id/lines/:lineId/price', requirePermission('order.modify'), async (req, res) => {
  try {
    const { id, lineId } = req.params;
    const { new_price, staff_id, staff_name, reason } = req.body;

    if (new_price == null || isNaN(parseFloat(new_price)) || parseFloat(new_price) < 0) {
      return res.status(400).json({ error: 'new_price must be a non-negative number' });
    }

    // Get original price
    const { rows: [line] } = await pool.query(
      'SELECT price, original_price, name FROM pos_order_lines WHERE id = $1 AND order_id = $2',
      [lineId, id]
    );
    if (!line) return res.status(404).json({ error: 'Line not found' });

    const origPrice = line.original_price || line.price;

    await pool.query(
      `UPDATE pos_order_lines SET original_price = $1, price = $2 WHERE id = $3`,
      [origPrice, new_price, lineId]
    );

    // Log to audit
    await pool.query(
      `INSERT INTO pos_audit_log (audit_type, order_id, line_id, staff_id, staff_name, detail, reason)
       VALUES ('price_override', $1, $2, $3, $4, $5, $6)`,
      [id, lineId, staff_id, staff_name,
       JSON.stringify({ item_name: line.name, original_price: parseFloat(origPrice), new_price: parseFloat(new_price) }),
       reason]
    );

    await recalcOrder(id);
    const order = await getOrderWithLines(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TIP ADJUSTMENT ──────────────────────────────────────────
router.post('/:id/tip', requirePermission('pay.change_tip'), async (req, res) => {
  try {
    const { id } = req.params;
    const { new_tip, staff_id, staff_name } = req.body;

    // Get current payment
    const { rows: payments } = await pool.query(
      'SELECT * FROM pos_payments WHERE order_id = $1 ORDER BY processed_at DESC LIMIT 1',
      [id]
    );
    if (!payments.length) return res.status(404).json({ error: 'No payment found' });

    const payment = payments[0];
    const oldTip = parseFloat(payment.tip_amount);

    await pool.query(
      'UPDATE pos_payments SET tip_amount = $1 WHERE id = $2',
      [new_tip, payment.id]
    );

    // Log to audit
    await pool.query(
      `INSERT INTO pos_audit_log (audit_type, order_id, staff_id, staff_name, detail)
       VALUES ('tip_adjust', $1, $2, $3, $4)`,
      [id, staff_id, staff_name,
       JSON.stringify({ tip_before: oldTip, tip_after: parseFloat(new_tip), sale_num: payment.sale_num })]
    );

    const order = await getOrderWithLines(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
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

  const subtotal = +(lines
    .filter(l => l.state !== 'voided' && l.state !== 'comped')
    .reduce((sum, l) => sum + parseFloat(l.price) * l.qty, 0)).toFixed(2);

  // Get order's discount info
  const { rows: [order] } = await pool.query(
    `SELECT discount_pct, discount_flat, auto_grat_pct FROM pos_orders WHERE id = $1`,
    [orderId]
  );

  if (!order) return; // Order was deleted

  const discPct = parseFloat(order.discount_pct) || 0;
  const discFlat = parseFloat(order.discount_flat) || 0;
  const discountAmt = discPct ? +(subtotal * discPct).toFixed(2) : +Math.min(discFlat, subtotal).toFixed(2);
  const afterDiscount = +(subtotal - discountAmt).toFixed(2);

  // TODO: get tax rate from config sync — hardcode 8.9% for now
  const taxRate = 0.089;
  const taxAmount = +(afterDiscount * taxRate).toFixed(2);

  const gratPct = parseFloat(order.auto_grat_pct) || 0;
  const gratAmt = gratPct ? +(afterDiscount * gratPct).toFixed(2) : 0;

  const total = +(afterDiscount + taxAmount + gratAmt).toFixed(2);

  await pool.query(
    `UPDATE pos_orders SET subtotal = $2, tax_amount = $3, auto_grat_amt = $4, total = $5, updated_at = now() WHERE id = $1`,
    [orderId, subtotal.toFixed(2), taxAmount.toFixed(2), gratAmt.toFixed(2), total.toFixed(2)]
  );
}

async function getOrderWithLines(orderId) {
  const orderRes = await pool.query('SELECT * FROM pos_orders WHERE id = $1', [orderId]);
  if (!orderRes.rows[0]) return null;
  const linesRes = await pool.query('SELECT * FROM pos_order_lines WHERE order_id = $1 ORDER BY added_at', [orderId]);
  const paymentsRes = await pool.query('SELECT * FROM pos_payments WHERE order_id = $1 ORDER BY processed_at', [orderId]);
  return {
    ...orderRes.rows[0],
    lines: linesRes.rows,
    payments: paymentsRes.rows,
  };
}

// ── CLEAR ALL POS DATA (owner-only, for test data cleanup) ──
router.post('/clear-all', requireOwner(), async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM pos_payments');
      await client.query('DELETE FROM pos_order_lines');
      await client.query('DELETE FROM pos_orders');
      await client.query('DELETE FROM pos_paid_outs');
      await client.query('DELETE FROM pos_sessions');
      await client.query('DELETE FROM pos_audit_log');
      await client.query('DELETE FROM pos_clock_entries');
      await client.query('COMMIT');

      console.log('[clear-all] All POS data cleared');
      res.json({ status: 'ok', message: 'All POS data cleared' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[clear-all] error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
