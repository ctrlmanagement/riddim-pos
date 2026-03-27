const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// PDF generators
const pdfDSR = require('../reports/pdf-dsr');
const pdfCheckout = require('../reports/pdf-checkout');
const pdfPaidOuts = require('../reports/pdf-paid-outs');
const pdfCustom = require('../reports/pdf-custom');

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

// ── DAILY SUMMARY REPORT (DSR) ──────────────────────────────
router.get('/dsr', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);

    // Sales by department/category
    const { rows: deptRows } = await pool.query(`
      SELECT
        COALESCE(l.name, 'OTHER') as department,
        SUM(CASE WHEN l.state NOT IN ('voided','comped') THEN l.price * l.qty ELSE 0 END) as gross_sales,
        SUM(CASE WHEN l.state = 'voided' THEN l.price * l.qty ELSE 0 END) as voids,
        SUM(CASE WHEN l.state = 'comped' THEN l.price * l.qty ELSE 0 END) as comps,
        SUM(CASE WHEN l.state NOT IN ('voided','comped') THEN l.qty ELSE 0 END) as qty
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2
        AND o.state IN ('paid','closed','voided')
      GROUP BY l.name
      ORDER BY gross_sales DESC
    `, [from, to]);

    // Order-level totals
    const { rows: [totals] } = await pool.query(`
      SELECT
        COALESCE(SUM(o.subtotal) FILTER (WHERE o.state IN ('paid','closed')), 0) as gross_sales,
        COALESCE(SUM(o.discount_flat + (o.subtotal * o.discount_pct)) FILTER (WHERE o.state IN ('paid','closed')), 0) as discounts,
        COALESCE(SUM(o.tax_amount) FILTER (WHERE o.state IN ('paid','closed')), 0) as sales_tax,
        COALESCE(SUM(o.auto_grat_amt) FILTER (WHERE o.state IN ('paid','closed')), 0) as service_fees,
        COUNT(DISTINCT o.id) FILTER (WHERE o.state IN ('paid','closed')) as order_count,
        COUNT(DISTINCT o.id) FILTER (WHERE o.state = 'voided') as void_count,
        COALESCE(SUM(o.customer_count) FILTER (WHERE o.state IN ('paid','closed')), 0) as guest_count
      FROM pos_orders o
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2
    `, [from, to]);

    // Comps
    const { rows: [compTotals] } = await pool.query(`
      SELECT
        COALESCE(SUM(l.price * l.qty), 0) as comp_total,
        COUNT(*) as comp_count
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND l.state = 'comped'
    `, [from, to]);

    // Comp breakdown by reason
    const { rows: compsByReason } = await pool.query(`
      SELECT
        COALESCE(l.comp_reason, 'No reason') as reason,
        SUM(l.price * l.qty) as amount,
        COUNT(*) as count
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND l.state = 'comped'
      GROUP BY l.comp_reason ORDER BY amount DESC
    `, [from, to]);

    // Void breakdown by reason
    const { rows: voidsByReason } = await pool.query(`
      SELECT
        COALESCE(l.void_reason, 'No reason') as reason,
        SUM(l.price * l.qty) as amount,
        COUNT(*) as count
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND l.state = 'voided'
      GROUP BY l.void_reason ORDER BY amount DESC
    `, [from, to]);

    // Payment summary
    const { rows: paymentRows } = await pool.query(`
      SELECT
        p.method,
        COUNT(DISTINCT o.id) as count,
        COALESCE(SUM(p.amount), 0) as sales,
        COALESCE(SUM(p.tip_amount), 0) as tips
      FROM pos_payments p
      JOIN pos_orders o ON o.id = p.order_id
      WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2
        AND o.state IN ('paid','closed')
      GROUP BY p.method
    `, [from, to]);

    // Paid outs
    const { rows: paidOutRows } = await pool.query(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM pos_paid_outs
      WHERE recorded_at::date >= $1 AND recorded_at::date <= $2
      GROUP BY category ORDER BY total DESC
    `, [from, to]);

    const totalPaidOuts = paidOutRows.reduce((s, r) => s + parseFloat(r.total), 0);

    // Build payment map
    const payMap = {};
    paymentRows.forEach(r => {
      payMap[r.method] = {
        count: parseInt(r.count),
        sales: parseFloat(r.sales),
        tips: parseFloat(r.tips),
      };
    });

    const grossSales = parseFloat(totals.gross_sales);
    const discounts = parseFloat(totals.discounts);
    const compTotal = parseFloat(compTotals.comp_total);
    const netSales = grossSales - discounts - compTotal;
    const salesTax = parseFloat(totals.sales_tax);
    const serviceFees = parseFloat(totals.service_fees);
    const cashSales = payMap.cash ? payMap.cash.sales : 0;
    const cashTips = payMap.cash ? payMap.cash.tips : 0;
    const cardSales = payMap.card ? payMap.card.sales : 0;
    const cardTips = payMap.card ? payMap.card.tips : 0;
    const totalTips = (payMap.cash ? payMap.cash.tips : 0) + (payMap.card ? payMap.card.tips : 0);

    // Cash reconciliation (page 2 of HotSauce DSR)
    const grossCash = cashSales + cashTips;
    const netCashRetained = cashSales - totalPaidOuts;
    const cashDeposit = netCashRetained;

    res.json({
      date_from: from,
      date_to: to,
      // Sales summary
      gross_sales: grossSales,
      discounts,
      comp_total: compTotal,
      net_sales: netSales,
      sales_tax: salesTax,
      service_fees: serviceFees,
      gross_revenue: netSales + salesTax,
      order_count: parseInt(totals.order_count),
      void_count: parseInt(totals.void_count),
      guest_count: parseInt(totals.guest_count),
      avg_check: parseInt(totals.order_count) > 0 ? (netSales + salesTax) / parseInt(totals.order_count) : 0,
      // Payment summary
      payments: payMap,
      total_tips: totalTips,
      // Expenditures
      paid_outs: paidOutRows.map(r => ({ category: r.category, total: parseFloat(r.total), count: parseInt(r.count) })),
      total_paid_outs: totalPaidOuts,
      // Cash reconciliation
      cash_reconciliation: {
        gross_cash: grossCash,
        less_tips: cashTips,
        less_srv_charge: serviceFees,
        paid_outs: totalPaidOuts,
        net_cash_retained: netCashRetained,
        cash_deposit: cashDeposit,
      },
      // Breakdowns
      comps_by_reason: compsByReason.map(r => ({ reason: r.reason, amount: parseFloat(r.amount), count: parseInt(r.count) })),
      voids_by_reason: voidsByReason.map(r => ({ reason: r.reason, amount: parseFloat(r.amount), count: parseInt(r.count) })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SERVER CHECKOUT REPORT ──────────────────────────────────
router.get('/checkout/:staffId', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);
    const staffId = req.params.staffId;

    // Staff's closed orders
    const { rows: [staffSales] } = await pool.query(`
      SELECT
        COUNT(DISTINCT o.id) as tabs,
        COALESCE(SUM(o.subtotal), 0) as gross_sales,
        COALESCE(SUM(o.discount_flat + (o.subtotal * o.discount_pct)), 0) as discounts,
        COALESCE(SUM(o.tax_amount), 0) as tax,
        COALESCE(SUM(o.auto_grat_amt), 0) as auto_grat
      FROM pos_orders o
      WHERE o.server_id = $1 AND o.opened_at::date >= $2 AND o.opened_at::date <= $3
        AND o.state IN ('paid','closed')
    `, [staffId, from, to]);

    // Payment breakdown
    const { rows: payRows } = await pool.query(`
      SELECT
        p.method,
        COUNT(DISTINCT o.id) as count,
        COALESCE(SUM(p.amount), 0) as sales,
        COALESCE(SUM(p.tip_amount), 0) as tips
      FROM pos_payments p
      JOIN pos_orders o ON o.id = p.order_id
      WHERE o.server_id = $1 AND o.opened_at::date >= $2 AND o.opened_at::date <= $3
        AND o.state IN ('paid','closed')
      GROUP BY p.method
    `, [staffId, from, to]);

    // Comp/void counts
    const { rows: [lineStats] } = await pool.query(`
      SELECT
        COALESCE(SUM(l.price * l.qty) FILTER (WHERE l.state = 'comped'), 0) as comp_total,
        COUNT(*) FILTER (WHERE l.state = 'comped') as comp_count,
        COUNT(*) FILTER (WHERE l.state = 'voided') as void_count
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE o.server_id = $1 AND o.opened_at::date >= $2 AND o.opened_at::date <= $3
    `, [staffId, from, to]);

    // Clock hours
    const { rows: clockRows } = await pool.query(`
      SELECT clock_in, clock_out
      FROM pos_clock_entries
      WHERE staff_id = $1 AND clock_in::date >= $2 AND clock_in::date <= $3
      ORDER BY clock_in
    `, [staffId, from, to]);

    let totalMinutes = 0;
    clockRows.forEach(c => {
      const cin = new Date(c.clock_in);
      const cout = c.clock_out ? new Date(c.clock_out) : new Date();
      totalMinutes += Math.floor((cout - cin) / 60000);
    });

    // Item breakdown
    const { rows: itemRows } = await pool.query(`
      SELECT
        l.name,
        SUM(l.qty) as qty,
        SUM(CASE WHEN l.state NOT IN ('voided','comped') THEN l.price * l.qty ELSE 0 END) as revenue
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE o.server_id = $1 AND o.opened_at::date >= $2 AND o.opened_at::date <= $3
        AND o.state IN ('paid','closed')
      GROUP BY l.name
      ORDER BY revenue DESC
    `, [staffId, from, to]);

    const payMap = {};
    payRows.forEach(r => {
      payMap[r.method] = { count: parseInt(r.count), sales: parseFloat(r.sales), tips: parseFloat(r.tips) };
    });

    const cashSales = payMap.cash ? payMap.cash.sales : 0;
    const cardTips = payMap.card ? payMap.card.tips : 0;

    // Staff name from first order
    const { rows: nameRow } = await pool.query(
      `SELECT server_name FROM pos_orders WHERE server_id = $1 LIMIT 1`, [staffId]
    );

    res.json({
      staff_id: staffId,
      staff_name: nameRow.length > 0 ? nameRow[0].server_name : 'Unknown',
      date_from: from,
      date_to: to,
      tabs: parseInt(staffSales.tabs),
      gross_sales: parseFloat(staffSales.gross_sales),
      discounts: parseFloat(staffSales.discounts),
      tax: parseFloat(staffSales.tax),
      auto_grat: parseFloat(staffSales.auto_grat),
      payments: payMap,
      comp_total: parseFloat(lineStats.comp_total),
      comp_count: parseInt(lineStats.comp_count),
      void_count: parseInt(lineStats.void_count),
      cash_due: cashSales,
      cc_tips: cardTips,
      hours_worked: Math.round(totalMinutes / 6) / 10,  // 1 decimal
      clock_entries: clockRows,
      items: itemRows.map(r => ({ name: r.name, qty: parseInt(r.qty), revenue: parseFloat(r.revenue) })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PAID OUT SUMMARY REPORT ─────────────────────────────────
router.get('/paid-out-summary', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);

    // Summary by category
    const { rows: categories } = await pool.query(`
      SELECT
        category,
        SUM(amount) as total,
        COUNT(*) as count
      FROM pos_paid_outs
      WHERE recorded_at::date >= $1 AND recorded_at::date <= $2
      GROUP BY category
      ORDER BY total DESC
    `, [from, to]);

    // Individual line items
    const { rows: details } = await pool.query(`
      SELECT id, category, amount, notes, staff_name, station_code, recorded_at
      FROM pos_paid_outs
      WHERE recorded_at::date >= $1 AND recorded_at::date <= $2
      ORDER BY category, recorded_at
    `, [from, to]);

    const grandTotal = categories.reduce((s, r) => s + parseFloat(r.total), 0);

    res.json({
      date_from: from,
      date_to: to,
      categories: categories.map(r => ({
        category: r.category,
        total: parseFloat(r.total),
        count: parseInt(r.count),
      })),
      details: details.map(r => ({
        id: r.id,
        category: r.category,
        amount: parseFloat(r.amount),
        notes: r.notes,
        staff_name: r.staff_name,
        station_code: r.station_code,
        recorded_at: r.recorded_at,
      })),
      grand_total: grandTotal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PDF EXPORT ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Helper: fetch JSON data from our own endpoint handler
async function fetchDSRData(from, to) {
  // Re-use the same query logic inline rather than HTTP self-call
  const { rows: [totals] } = await pool.query(`
    SELECT
      COALESCE(SUM(o.subtotal) FILTER (WHERE o.state IN ('paid','closed')), 0) as gross_sales,
      COALESCE(SUM(o.discount_flat + (o.subtotal * o.discount_pct)) FILTER (WHERE o.state IN ('paid','closed')), 0) as discounts,
      COALESCE(SUM(o.tax_amount) FILTER (WHERE o.state IN ('paid','closed')), 0) as sales_tax,
      COALESCE(SUM(o.auto_grat_amt) FILTER (WHERE o.state IN ('paid','closed')), 0) as service_fees,
      COUNT(DISTINCT o.id) FILTER (WHERE o.state IN ('paid','closed')) as order_count,
      COUNT(DISTINCT o.id) FILTER (WHERE o.state = 'voided') as void_count,
      COALESCE(SUM(o.customer_count) FILTER (WHERE o.state IN ('paid','closed')), 0) as guest_count
    FROM pos_orders o
    WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2
  `, [from, to]);

  const { rows: [compTotals] } = await pool.query(`
    SELECT COALESCE(SUM(l.price * l.qty), 0) as comp_total, COUNT(*) as comp_count
    FROM pos_order_lines l JOIN pos_orders o ON o.id = l.order_id
    WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND l.state = 'comped'
  `, [from, to]);

  const { rows: compsByReason } = await pool.query(`
    SELECT COALESCE(l.comp_reason, 'No reason') as reason, SUM(l.price * l.qty) as amount, COUNT(*) as count
    FROM pos_order_lines l JOIN pos_orders o ON o.id = l.order_id
    WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND l.state = 'comped'
    GROUP BY l.comp_reason ORDER BY amount DESC
  `, [from, to]);

  const { rows: voidsByReason } = await pool.query(`
    SELECT COALESCE(l.void_reason, 'No reason') as reason, SUM(l.price * l.qty) as amount, COUNT(*) as count
    FROM pos_order_lines l JOIN pos_orders o ON o.id = l.order_id
    WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND l.state = 'voided'
    GROUP BY l.void_reason ORDER BY amount DESC
  `, [from, to]);

  const { rows: paymentRows } = await pool.query(`
    SELECT p.method, COUNT(DISTINCT o.id) as count, COALESCE(SUM(p.amount), 0) as sales, COALESCE(SUM(p.tip_amount), 0) as tips
    FROM pos_payments p JOIN pos_orders o ON o.id = p.order_id
    WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND o.state IN ('paid','closed')
    GROUP BY p.method
  `, [from, to]);

  const { rows: paidOutRows } = await pool.query(`
    SELECT category, SUM(amount) as total, COUNT(*) as count
    FROM pos_paid_outs WHERE recorded_at::date >= $1 AND recorded_at::date <= $2
    GROUP BY category ORDER BY total DESC
  `, [from, to]);

  const payMap = {};
  paymentRows.forEach(r => { payMap[r.method] = { count: parseInt(r.count), sales: parseFloat(r.sales), tips: parseFloat(r.tips) }; });

  const grossSales = parseFloat(totals.gross_sales);
  const discounts = parseFloat(totals.discounts);
  const compTotal = parseFloat(compTotals.comp_total);
  const netSales = grossSales - discounts - compTotal;
  const salesTax = parseFloat(totals.sales_tax);
  const serviceFees = parseFloat(totals.service_fees);
  const cash = payMap.cash || { count: 0, sales: 0, tips: 0 };
  const card = payMap.card || { count: 0, sales: 0, tips: 0 };
  const totalTips = cash.tips + card.tips;
  const totalPaidOuts = paidOutRows.reduce((s, r) => s + parseFloat(r.total), 0);

  return {
    date_from: from, date_to: to,
    gross_sales: grossSales, discounts, comp_total: compTotal, net_sales: netSales,
    sales_tax: salesTax, service_fees: serviceFees, gross_revenue: netSales + salesTax,
    order_count: parseInt(totals.order_count), void_count: parseInt(totals.void_count),
    guest_count: parseInt(totals.guest_count),
    avg_check: parseInt(totals.order_count) > 0 ? (netSales + salesTax) / parseInt(totals.order_count) : 0,
    payments: payMap, total_tips: totalTips,
    paid_outs: paidOutRows.map(r => ({ category: r.category, total: parseFloat(r.total), count: parseInt(r.count) })),
    total_paid_outs: totalPaidOuts,
    cash_reconciliation: {
      gross_cash: cash.sales + cash.tips, less_tips: cash.tips, less_srv_charge: serviceFees,
      paid_outs: totalPaidOuts, net_cash_retained: cash.sales - totalPaidOuts, cash_deposit: cash.sales - totalPaidOuts,
    },
    comps_by_reason: compsByReason.map(r => ({ reason: r.reason, amount: parseFloat(r.amount), count: parseInt(r.count) })),
    voids_by_reason: voidsByReason.map(r => ({ reason: r.reason, amount: parseFloat(r.amount), count: parseInt(r.count) })),
  };
}

// ── DSR PDF ──
router.get('/dsr/pdf', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);
    const data = await fetchDSRData(from, to);
    const doc = pdfDSR.generate(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="RIDDIM_DSR_${from}.pdf"`);
    doc.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Checkout PDF ──
router.get('/checkout/:staffId/pdf', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);
    const staffId = req.params.staffId;

    // Reuse checkout query logic
    const { rows: [staffSales] } = await pool.query(`
      SELECT COUNT(DISTINCT o.id) as tabs, COALESCE(SUM(o.subtotal), 0) as gross_sales,
        COALESCE(SUM(o.discount_flat + (o.subtotal * o.discount_pct)), 0) as discounts,
        COALESCE(SUM(o.tax_amount), 0) as tax, COALESCE(SUM(o.auto_grat_amt), 0) as auto_grat
      FROM pos_orders o
      WHERE o.server_id = $1 AND o.opened_at::date >= $2 AND o.opened_at::date <= $3 AND o.state IN ('paid','closed')
    `, [staffId, from, to]);

    const { rows: payRows } = await pool.query(`
      SELECT p.method, COUNT(DISTINCT o.id) as count, COALESCE(SUM(p.amount), 0) as sales, COALESCE(SUM(p.tip_amount), 0) as tips
      FROM pos_payments p JOIN pos_orders o ON o.id = p.order_id
      WHERE o.server_id = $1 AND o.opened_at::date >= $2 AND o.opened_at::date <= $3 AND o.state IN ('paid','closed')
      GROUP BY p.method
    `, [staffId, from, to]);

    const { rows: [lineStats] } = await pool.query(`
      SELECT COALESCE(SUM(l.price * l.qty) FILTER (WHERE l.state = 'comped'), 0) as comp_total,
        COUNT(*) FILTER (WHERE l.state = 'comped') as comp_count, COUNT(*) FILTER (WHERE l.state = 'voided') as void_count
      FROM pos_order_lines l JOIN pos_orders o ON o.id = l.order_id
      WHERE o.server_id = $1 AND o.opened_at::date >= $2 AND o.opened_at::date <= $3
    `, [staffId, from, to]);

    const { rows: clockRows } = await pool.query(`
      SELECT clock_in, clock_out FROM pos_clock_entries
      WHERE staff_id = $1 AND clock_in::date >= $2 AND clock_in::date <= $3 ORDER BY clock_in
    `, [staffId, from, to]);

    let totalMinutes = 0;
    clockRows.forEach(c => { const cin = new Date(c.clock_in); const cout = c.clock_out ? new Date(c.clock_out) : new Date(); totalMinutes += Math.floor((cout - cin) / 60000); });

    const { rows: itemRows } = await pool.query(`
      SELECT l.name, SUM(l.qty) as qty, SUM(CASE WHEN l.state NOT IN ('voided','comped') THEN l.price * l.qty ELSE 0 END) as revenue
      FROM pos_order_lines l JOIN pos_orders o ON o.id = l.order_id
      WHERE o.server_id = $1 AND o.opened_at::date >= $2 AND o.opened_at::date <= $3 AND o.state IN ('paid','closed')
      GROUP BY l.name ORDER BY revenue DESC
    `, [staffId, from, to]);

    const payMap = {};
    payRows.forEach(r => { payMap[r.method] = { count: parseInt(r.count), sales: parseFloat(r.sales), tips: parseFloat(r.tips) }; });
    const { rows: nameRow } = await pool.query(`SELECT server_name FROM pos_orders WHERE server_id = $1 LIMIT 1`, [staffId]);

    const data = {
      staff_id: staffId, staff_name: nameRow.length > 0 ? nameRow[0].server_name : 'Unknown',
      date_from: from, date_to: to, tabs: parseInt(staffSales.tabs),
      gross_sales: parseFloat(staffSales.gross_sales), discounts: parseFloat(staffSales.discounts),
      tax: parseFloat(staffSales.tax), auto_grat: parseFloat(staffSales.auto_grat),
      payments: payMap, comp_total: parseFloat(lineStats.comp_total),
      comp_count: parseInt(lineStats.comp_count), void_count: parseInt(lineStats.void_count),
      cash_due: payMap.cash ? payMap.cash.sales : 0, cc_tips: payMap.card ? payMap.card.tips : 0,
      hours_worked: Math.round(totalMinutes / 6) / 10, clock_entries: clockRows,
      items: itemRows.map(r => ({ name: r.name, qty: parseInt(r.qty), revenue: parseFloat(r.revenue) })),
    };

    const doc = pdfCheckout.generate(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="RIDDIM_Checkout_${data.staff_name}_${from}.pdf"`);
    doc.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Paid Out Summary PDF ──
router.get('/paid-out-summary/pdf', async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);

    const { rows: categories } = await pool.query(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM pos_paid_outs WHERE recorded_at::date >= $1 AND recorded_at::date <= $2
      GROUP BY category ORDER BY total DESC
    `, [from, to]);

    const { rows: details } = await pool.query(`
      SELECT id, category, amount, notes, staff_name, station_code, recorded_at
      FROM pos_paid_outs WHERE recorded_at::date >= $1 AND recorded_at::date <= $2
      ORDER BY category, recorded_at
    `, [from, to]);

    const data = {
      date_from: from, date_to: to,
      categories: categories.map(r => ({ category: r.category, total: parseFloat(r.total), count: parseInt(r.count) })),
      details: details.map(r => ({ ...r, amount: parseFloat(r.amount) })),
      grand_total: categories.reduce((s, r) => s + parseFloat(r.total), 0),
    };

    const doc = pdfPaidOuts.generate(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="RIDDIM_PaidOuts_${from}.pdf"`);
    doc.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CUSTOM REPORT
// ═══════════════════════════════════════════════════════════════

// GET available sections for the builder UI
router.get('/custom/sections', (req, res) => {
  res.json(pdfCustom.SECTION_LIST);
});

// POST custom report — JSON or PDF
router.post('/custom', async (req, res) => {
  try {
    const { sections, preset_name, format } = req.body;
    const { from, to } = dateParams(req.query.date_from ? req.query : req.body);

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ error: 'sections array required' });
    }

    // Determine which data queries we need based on selected sections
    const data = { date_from: from, date_to: to };

    // DSR data (needed by most sections)
    const needsDSR = sections.some(s => ['sales_summary', 'payment_summary', 'cash_reconciliation', 'paid_outs', 'comp_summary', 'void_summary'].includes(s));
    if (needsDSR) {
      Object.assign(data, await fetchDSRData(from, to));
    }

    // Employee data
    if (sections.includes('employee_sales') || sections.includes('employee_tips')) {
      const { rows } = await pool.query(`
        SELECT o.server_id, o.server_name, COUNT(DISTINCT o.id) as tabs,
          COALESCE(SUM(o.total), 0) as sales, COALESCE(SUM(p.tip_amount), 0) as tips
        FROM pos_orders o LEFT JOIN pos_payments p ON p.order_id = o.id
        WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND o.state IN ('paid','closed')
        GROUP BY o.server_id, o.server_name ORDER BY sales DESC
      `, [from, to]);

      const { rows: clockRows } = await pool.query(`
        SELECT staff_id, SUM(EXTRACT(EPOCH FROM (COALESCE(clock_out, now()) - clock_in)) / 3600) as hours
        FROM pos_clock_entries WHERE clock_in::date >= $1 AND clock_in::date <= $2
        GROUP BY staff_id
      `, [from, to]);
      const clockMap = {};
      clockRows.forEach(c => clockMap[c.staff_id] = parseFloat(c.hours));

      data.employees = rows.map(r => ({
        server_id: r.server_id, server_name: r.server_name,
        tabs: parseInt(r.tabs), sales: parseFloat(r.sales), tips: parseFloat(r.tips),
        hours: clockMap[r.server_id] || 0,
      }));
    }

    // Hourly data
    if (sections.includes('hourly_sales')) {
      const { rows } = await pool.query(`
        SELECT EXTRACT(HOUR FROM o.opened_at) as hour, COUNT(DISTINCT o.id) as tabs,
          COALESCE(SUM(o.total), 0) as sales,
          COALESCE(SUM((SELECT SUM(l2.qty) FROM pos_order_lines l2 WHERE l2.order_id = o.id AND l2.state NOT IN ('voided'))), 0) as items
        FROM pos_orders o WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND o.state IN ('paid','closed')
        GROUP BY EXTRACT(HOUR FROM o.opened_at) ORDER BY hour
      `, [from, to]);
      data.hours = rows.map(r => ({
        hour: parseInt(r.hour), label: ((parseInt(r.hour) % 12) || 12) + (parseInt(r.hour) < 12 ? ' AM' : ' PM'),
        tabs: parseInt(r.tabs), sales: parseFloat(r.sales), items: parseInt(r.items),
      }));
    }

    // Station data
    if (sections.includes('station_sales')) {
      const { rows } = await pool.query(`
        SELECT o.station_code as station, COUNT(DISTINCT o.id) as tabs,
          COALESCE(SUM(o.total), 0) as sales, COALESCE(SUM(p.tip_amount), 0) as tips
        FROM pos_orders o LEFT JOIN pos_payments p ON p.order_id = o.id
        WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND o.state IN ('paid','closed')
        GROUP BY o.station_code ORDER BY sales DESC
      `, [from, to]);
      data.stations = rows.map(r => ({ station: r.station, tabs: parseInt(r.tabs), sales: parseFloat(r.sales), tips: parseFloat(r.tips) }));
    }

    // Product mix data
    if (sections.includes('product_mix') || sections.includes('top_items')) {
      const { rows } = await pool.query(`
        SELECT l.name, SUM(l.qty) as qty,
          SUM(CASE WHEN l.state NOT IN ('voided','comped') THEN l.price * l.qty ELSE 0 END) as revenue
        FROM pos_order_lines l JOIN pos_orders o ON o.id = l.order_id
        WHERE o.opened_at::date >= $1 AND o.opened_at::date <= $2 AND o.state IN ('paid','closed','sent','held','open')
        GROUP BY l.name ORDER BY revenue DESC
      `, [from, to]);
      const totalRevenue = rows.reduce((s, r) => s + parseFloat(r.revenue), 0);
      data.items = rows.map(r => ({
        name: r.name, qty: parseInt(r.qty), revenue: parseFloat(r.revenue),
        pct: totalRevenue > 0 ? parseFloat(r.revenue) / totalRevenue * 100 : 0,
      }));
    }

    // Clock log
    if (sections.includes('clock_entries')) {
      const { rows } = await pool.query(`
        SELECT staff_id, staff_name, clock_in, clock_out
        FROM pos_clock_entries WHERE clock_in::date >= $1 AND clock_in::date <= $2
        ORDER BY clock_in
      `, [from, to]);
      data.clock_log = rows;
    }

    // Return PDF or JSON
    if (format === 'pdf') {
      const doc = pdfCustom.generate(sections, data, preset_name);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="RIDDIM_Custom_${from}.pdf"`);
      doc.pipe(res);
    } else {
      res.json({ sections, data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
