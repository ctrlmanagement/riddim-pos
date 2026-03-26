const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// All reports accept ?date_from=...&date_to=... (defaults to today)
function dateParams(query) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    from: query.date_from || today,
    to: query.date_to || today,
  };
}

// ── SALES SUMMARY ───────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);

    const { rows: [stats] } = await pool.query(`
      SELECT
        COUNT(DISTINCT o.id) FILTER (WHERE o.state IN ('paid','closed')) as checks_closed,
        COUNT(DISTINCT o.id) FILTER (WHERE o.state = 'voided') as checks_voided,
        COUNT(DISTINCT o.id) FILTER (WHERE o.state IN ('open','sent','held')) as checks_open,
        COALESCE(SUM(DISTINCT o.subtotal) FILTER (WHERE o.state IN ('paid','closed')), 0) as gross_sales,
        COALESCE(SUM(DISTINCT o.tax_amount) FILTER (WHERE o.state IN ('paid','closed')), 0) as tax,
        COALESCE(SUM(DISTINCT o.total) FILTER (WHERE o.state IN ('paid','closed')), 0) as total_with_tax,
        COALESCE(SUM(p.tip_amount) FILTER (WHERE o.state IN ('paid','closed')), 0) as tips,
        COUNT(DISTINCT o.id) FILTER (WHERE p.method = 'card' AND o.state IN ('paid','closed')) as card_count,
        COUNT(DISTINCT o.id) FILTER (WHERE p.method = 'cash' AND o.state IN ('paid','closed')) as cash_count,
        COUNT(DISTINCT o.id) FILTER (WHERE p.method = 'comp' AND o.state IN ('paid','closed')) as comp_count,
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'card'), 0) as card_sales,
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'cash'), 0) as cash_sales,
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'comp'), 0) as comp_sales,
        COALESCE(SUM(p.tip_amount) FILTER (WHERE p.method = 'card'), 0) as card_tips,
        COALESCE(SUM(p.tip_amount) FILTER (WHERE p.method = 'cash'), 0) as cash_tips
      FROM pos_orders o
      LEFT JOIN pos_payments p ON p.order_id = o.id
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2
    `, [from, to]);

    // Comps + discounts from line items
    const { rows: [lineStats] } = await pool.query(`
      SELECT
        COALESCE(SUM(l.price * l.qty) FILTER (WHERE l.state = 'comped'), 0) as comp_amount,
        COUNT(*) FILTER (WHERE l.state = 'comped') as comp_items,
        COUNT(*) FILTER (WHERE l.state = 'voided') as void_items
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2
    `, [from, to]);

    const checksClosedNum = parseInt(stats.checks_closed);
    const grossNum = parseFloat(stats.gross_sales);
    const taxNum = parseFloat(stats.tax);
    const compAmtNum = parseFloat(lineStats.comp_amount);
    const netSales = grossNum - compAmtNum;
    const avgCheck = checksClosedNum > 0 ? (netSales + taxNum) / checksClosedNum : 0;

    res.json({
      date_from: from,
      date_to: to,
      checks_closed: checksClosedNum,
      checks_voided: parseInt(stats.checks_voided),
      checks_open: parseInt(stats.checks_open),
      gross_sales: grossNum,
      net_sales: netSales,
      tax: taxNum,
      tips: parseFloat(stats.tips),
      avg_check: avgCheck,
      comp_amount: compAmtNum,
      comp_items: parseInt(lineStats.comp_items),
      void_items: parseInt(lineStats.void_items),
      card: { count: parseInt(stats.card_count), sales: parseFloat(stats.card_sales), tips: parseFloat(stats.card_tips) },
      cash: { count: parseInt(stats.cash_count), sales: parseFloat(stats.cash_sales), tips: parseFloat(stats.cash_tips) },
      comp: { count: parseInt(stats.comp_count), sales: parseFloat(stats.comp_sales) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PRODUCT MIX ─────────────────────────────────────────────
router.get('/product-mix', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);

    const { rows } = await pool.query(`
      SELECT
        l.name,
        l.menu_item_id,
        SUM(l.qty) as qty,
        SUM(CASE WHEN l.state NOT IN ('voided','comped') THEN l.price * l.qty ELSE 0 END) as revenue,
        SUM(CASE WHEN l.state = 'comped' THEN l.qty ELSE 0 END) as comped_qty,
        SUM(CASE WHEN l.state = 'voided' THEN l.qty ELSE 0 END) as voided_qty
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2
        AND o.state IN ('paid','closed','sent','held','open')
      GROUP BY l.name, l.menu_item_id
      ORDER BY revenue DESC
    `, [from, to]);

    const totalRevenue = rows.reduce((s, r) => s + parseFloat(r.revenue), 0);

    res.json({
      items: rows.map(r => ({
        name: r.name,
        menu_item_id: r.menu_item_id,
        qty: parseInt(r.qty),
        revenue: parseFloat(r.revenue),
        pct: totalRevenue > 0 ? parseFloat(r.revenue) / totalRevenue * 100 : 0,
        comped_qty: parseInt(r.comped_qty),
        voided_qty: parseInt(r.voided_qty),
      })),
      total_revenue: totalRevenue,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EMPLOYEE REPORT ─────────────────────────────────────────
router.get('/employee', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);

    const { rows } = await pool.query(`
      SELECT
        o.server_id,
        o.server_name,
        COUNT(DISTINCT o.id) as tabs,
        COALESCE(SUM(o.total), 0) as sales,
        COALESCE(SUM(p.tip_amount), 0) as tips,
        COALESCE(SUM(
          (SELECT SUM(l2.qty) FROM pos_order_lines l2 WHERE l2.order_id = o.id AND l2.state NOT IN ('voided'))
        ), 0) as items
      FROM pos_orders o
      LEFT JOIN pos_payments p ON p.order_id = o.id
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2
        AND o.state IN ('paid','closed')
      GROUP BY o.server_id, o.server_name
      ORDER BY sales DESC
    `, [from, to]);

    // Clock hours
    const { rows: clockRows } = await pool.query(`
      SELECT
        staff_id,
        staff_name,
        SUM(EXTRACT(EPOCH FROM (COALESCE(clock_out, now()) - clock_in)) / 3600) as hours
      FROM pos_clock_entries
      WHERE clock_in::date >= $1 AND clock_in::date <= $2
      GROUP BY staff_id, staff_name
    `, [from, to]);

    const clockMap = {};
    clockRows.forEach(c => clockMap[c.staff_id] = parseFloat(c.hours));

    res.json({
      employees: rows.map(r => ({
        server_id: r.server_id,
        server_name: r.server_name,
        tabs: parseInt(r.tabs),
        sales: parseFloat(r.sales),
        tips: parseFloat(r.tips),
        items: parseInt(r.items),
        hours: clockMap[r.server_id] || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HOURLY REPORT ───────────────────────────────────────────
router.get('/hourly', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);

    const { rows } = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM o.opened_at) as hour,
        COUNT(DISTINCT o.id) as tabs,
        COALESCE(SUM(o.total), 0) as sales,
        COALESCE(SUM(
          (SELECT SUM(l2.qty) FROM pos_order_lines l2 WHERE l2.order_id = o.id AND l2.state NOT IN ('voided'))
        ), 0) as items
      FROM pos_orders o
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2
        AND o.state IN ('paid','closed')
      GROUP BY EXTRACT(HOUR FROM o.opened_at)
      ORDER BY hour
    `, [from, to]);

    res.json({
      hours: rows.map(r => ({
        hour: parseInt(r.hour),
        label: ((parseInt(r.hour) % 12) || 12) + (parseInt(r.hour) < 12 ? ' AM' : ' PM'),
        tabs: parseInt(r.tabs),
        sales: parseFloat(r.sales),
        items: parseInt(r.items),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── STATION REPORT ──────────────────────────────────────────
router.get('/station', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);

    const { rows } = await pool.query(`
      SELECT
        o.station_code,
        COUNT(DISTINCT o.id) as tabs,
        COALESCE(SUM(o.total), 0) as sales,
        COALESCE(SUM(p.tip_amount), 0) as tips,
        COALESCE(SUM(
          (SELECT SUM(l2.qty) FROM pos_order_lines l2 WHERE l2.order_id = o.id AND l2.state NOT IN ('voided'))
        ), 0) as items
      FROM pos_orders o
      LEFT JOIN pos_payments p ON p.order_id = o.id
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2
        AND o.state IN ('paid','closed')
      GROUP BY o.station_code
      ORDER BY sales DESC
    `, [from, to]);

    res.json({
      stations: rows.map(r => ({
        station: r.station_code,
        tabs: parseInt(r.tabs),
        sales: parseFloat(r.sales),
        tips: parseFloat(r.tips),
        items: parseInt(r.items),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
