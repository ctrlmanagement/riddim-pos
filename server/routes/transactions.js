const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// ── SEARCH transactions ─────────────────────────────────────
// GET /api/transactions?date=2026-03-26&server_id=...&sale_id=1003&order_num=1004&method=card&min=10&max=100&limit=50&offset=0
router.get('/', async (req, res) => {
  try {
    const { date, date_from, date_to, server_id, sale_id, order_num, method, min, max, limit, offset } = req.query;

    let query = `
      SELECT o.id, o.order_num, o.tab_name, o.table_num, o.server_id, o.server_name,
             o.station_code, o.state, o.subtotal, o.discount_pct, o.discount_flat,
             o.tax_amount, o.auto_grat_amt, o.total, o.customer_count,
             o.opened_at, o.paid_at, o.closed_at, o.voided_at, o.void_reason,
             p.sale_num, p.method, p.amount as pay_amount, p.tip_amount, p.processed_at
      FROM pos_orders o
      LEFT JOIN pos_payments p ON p.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      params.push(date);
      query += ` AND o.opened_at::date = $${params.length}`;
    }
    if (date_from) {
      params.push(date_from);
      query += ` AND o.opened_at::date >= $${params.length}`;
    }
    if (date_to) {
      params.push(date_to);
      query += ` AND o.opened_at::date <= $${params.length}`;
    }
    if (server_id) {
      params.push(server_id);
      query += ` AND o.server_id = $${params.length}`;
    }
    if (sale_id) {
      params.push(parseInt(sale_id));
      query += ` AND p.sale_num = $${params.length}`;
    }
    if (order_num) {
      params.push(parseInt(order_num));
      query += ` AND o.order_num = $${params.length}`;
    }
    if (method) {
      params.push(method);
      query += ` AND p.method = $${params.length}`;
    }
    if (min) {
      params.push(parseFloat(min));
      query += ` AND o.total >= $${params.length}`;
    }
    if (max) {
      params.push(parseFloat(max));
      query += ` AND o.total <= $${params.length}`;
    }

    query += ' ORDER BY o.opened_at DESC';

    const lim = Math.min(parseInt(limit) || 100, 500);
    const off = parseInt(offset) || 0;
    params.push(lim, off);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);

    // Also get total count for pagination
    let countQuery = `SELECT COUNT(DISTINCT o.id) as total FROM pos_orders o LEFT JOIN pos_payments p ON p.order_id = o.id WHERE 1=1`;
    const countParams = [];

    if (date) { countParams.push(date); countQuery += ` AND o.opened_at::date = $${countParams.length}`; }
    if (date_from) { countParams.push(date_from); countQuery += ` AND o.opened_at::date >= $${countParams.length}`; }
    if (date_to) { countParams.push(date_to); countQuery += ` AND o.opened_at::date <= $${countParams.length}`; }
    if (server_id) { countParams.push(server_id); countQuery += ` AND o.server_id = $${countParams.length}`; }
    if (method) { countParams.push(method); countQuery += ` AND p.method = $${countParams.length}`; }

    const countRes = await pool.query(countQuery, countParams);

    res.json({
      transactions: rows,
      total: parseInt(countRes.rows[0].total),
      limit: lim,
      offset: off,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Transaction PDF export ───────────────────────────────────
const pdfTransactions = require('../reports/pdf-transactions');

router.get('/export/pdf', async (req, res) => {
  try {
    const { date, date_from, date_to, server_id, sale_id, order_num, method, min, max } = req.query;
    let query = `
      SELECT o.id, o.order_num, o.tab_name, o.server_name, o.station_code, o.state,
             o.total, o.opened_at, p.method, p.amount as pay_amount, p.tip_amount
      FROM pos_orders o LEFT JOIN pos_payments p ON p.order_id = o.id WHERE 1=1
    `;
    const params = [];
    if (date) { params.push(date); query += ` AND o.opened_at::date = $${params.length}`; }
    if (date_from) { params.push(date_from); query += ` AND o.opened_at::date >= $${params.length}`; }
    if (date_to) { params.push(date_to); query += ` AND o.opened_at::date <= $${params.length}`; }
    if (server_id) { params.push(server_id); query += ` AND o.server_id = $${params.length}`; }
    if (method) { params.push(method); query += ` AND p.method = $${params.length}`; }
    query += ' ORDER BY o.opened_at DESC LIMIT 500';
    const { rows } = await pool.query(query, params);

    // Stats
    const totalSales = rows.reduce((s, r) => s + parseFloat(r.pay_amount || r.total || 0), 0);
    const totalTips = rows.reduce((s, r) => s + parseFloat(r.tip_amount || 0), 0);

    const from = date_from || date || new Date().toISOString().slice(0, 10);
    const to = date_to || date || new Date().toISOString().slice(0, 10);
    const data = {
      date_from: from, date_to: to,
      transactions: rows,
      stats: { total: rows.length, total_sales: totalSales, total_tips: totalTips },
    };
    const doc = pdfTransactions.generate(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="RIDDIM_Transactions_${from}.pdf"`);
    doc.pipe(res);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET single transaction detail ───────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orderRes = await pool.query('SELECT * FROM pos_orders WHERE id = $1', [id]);
    if (!orderRes.rows.length) return res.status(404).json({ error: 'Not found' });

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

// ── GET summary stats ───────────────────────────────────────
router.get('/stats/summary', async (req, res) => {
  try {
    const { date } = req.query;
    const dateFilter = date ? `AND o.opened_at::date = $1` : '';
    const params = date ? [date] : [];

    const { rows } = await pool.query(`
      SELECT
        COUNT(DISTINCT o.id) FILTER (WHERE o.state = 'paid' OR o.state = 'closed') as paid_count,
        COUNT(DISTINCT o.id) FILTER (WHERE o.state = 'voided') as void_count,
        COALESCE(SUM(DISTINCT o.total) FILTER (WHERE o.state IN ('paid','closed')), 0) as total_sales,
        COALESCE(SUM(p.tip_amount), 0) as total_tips,
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'card'), 0) as card_sales,
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'cash'), 0) as cash_sales,
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'comp'), 0) as comp_sales
      FROM pos_orders o
      LEFT JOIN pos_payments p ON p.order_id = o.id
      WHERE 1=1 ${dateFilter}
    `, params);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
