const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { supabaseAdmin } = require('../db/supabase');
const { PAIDOUT_CATEGORIES } = require('./paid-outs');

// Day names matching RIDDIM owner_pl.js dayMap
const DAY_NAMES = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];

// ── CLOSE DAY — aggregate POS data and push to daily_payouts ──
router.post('/close', async (req, res) => {
  try {
    const { closed_by, closed_by_name, date } = req.body;
    const businessDate = date || new Date().toISOString().slice(0, 10);

    if (!closed_by) {
      return res.status(400).json({ error: 'closed_by (staff_id) required' });
    }

    // ── 1. Check no open tabs remain ──
    const { rows: [openCheck] } = await pool.query(
      `SELECT COUNT(*) as ct FROM pos_orders
       WHERE state IN ('open','sent','held') AND opened_at::date = $1`,
      [businessDate]
    );
    if (parseInt(openCheck.ct) > 0) {
      return res.status(400).json({
        error: `${openCheck.ct} open tab(s) remain — close all tabs before closing the day`,
      });
    }

    // ── 2. Aggregate sales data ──
    const { rows: [sales] } = await pool.query(`
      SELECT
        COALESCE(SUM(o.subtotal) FILTER (WHERE o.state IN ('paid','closed')), 0) as net_sales,
        COALESCE(SUM(o.tax_amount) FILTER (WHERE o.state IN ('paid','closed')), 0) as sales_tax,
        COALESCE(SUM(o.auto_grat_amt) FILTER (WHERE o.state IN ('paid','closed')), 0) as service_fees,
        COUNT(DISTINCT o.id) FILTER (WHERE o.state IN ('paid','closed')) as order_count,
        COUNT(DISTINCT o.id) FILTER (WHERE o.state = 'voided') as void_count
      FROM pos_orders o
      WHERE o.opened_at::date = $1
    `, [businessDate]);

    // ── 3. Payment breakdown ──
    const { rows: [payments] } = await pool.query(`
      SELECT
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'cash'), 0) as cash_sales,
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'card'), 0) as card_sales,
        COALESCE(SUM(p.tip_amount) FILTER (WHERE p.method = 'cash'), 0) as cash_tips,
        COALESCE(SUM(p.tip_amount) FILTER (WHERE p.method = 'card'), 0) as card_tips,
        COALESCE(SUM(p.tip_amount), 0) as total_tips
      FROM pos_payments p
      JOIN pos_orders o ON o.id = p.order_id
      WHERE o.opened_at::date = $1 AND o.state IN ('paid','closed')
    `, [businessDate]);

    // ── 4. Comp totals ──
    const { rows: [comps] } = await pool.query(`
      SELECT COALESCE(SUM(l.price * l.qty), 0) as comp_total
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE o.opened_at::date = $1 AND l.state = 'comped'
    `, [businessDate]);

    // ── 5. Station-level CC breakdowns (for collection labels) ──
    const { rows: stationCC } = await pool.query(`
      SELECT
        o.station_code,
        COALESCE(SUM(p.amount + p.tip_amount), 0) as cc_total
      FROM pos_payments p
      JOIN pos_orders o ON o.id = p.order_id
      WHERE o.opened_at::date = $1 AND p.method = 'card' AND o.state IN ('paid','closed')
      GROUP BY o.station_code
    `, [businessDate]);

    // ── 6. Paid outs by category ──
    const { rows: paidOuts } = await pool.query(
      `SELECT category, SUM(amount) as total FROM pos_paid_outs
       WHERE recorded_at::date = $1 GROUP BY category`,
      [businessDate]
    );

    const totalPaidOuts = paidOuts.reduce((s, r) => s + parseFloat(r.total), 0);

    // ── 7. Save session locally ──
    const { rows: [session] } = await pool.query(
      `INSERT INTO pos_sessions (closed_at, closed_by, total_sales, total_tax, total_tips, total_comps, total_voids, order_count)
       VALUES (now(), $1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        closed_by,
        parseFloat(sales.net_sales),
        parseFloat(sales.sales_tax),
        parseFloat(payments.total_tips),
        parseFloat(comps.comp_total),
        parseInt(sales.void_count),
        parseInt(sales.order_count),
      ]
    );

    // ── 8. Build daily_payouts rows ──
    const dayOfWeek = DAY_NAMES[new Date(businessDate + 'T12:00:00').getDay()];
    const payoutRows = [];

    // DSR fields
    payoutRows.push({ label: 'DSR:Net Sales', amount: parseFloat(sales.net_sales) });
    payoutRows.push({ label: 'DSR:Sales Taxes', amount: parseFloat(sales.sales_tax) });
    payoutRows.push({ label: 'DSR:Emp Tips Payable', amount: parseFloat(payments.total_tips) });
    payoutRows.push({ label: 'DSR:POS Bar Cash', amount: parseFloat(payments.cash_sales) });
    payoutRows.push({ label: 'DSR:POS Bar CC', amount: parseFloat(payments.card_sales) });
    payoutRows.push({ label: 'DSR:Comp Total', amount: parseFloat(comps.comp_total) });
    payoutRows.push({ label: 'DSR:Table Service Fees', amount: parseFloat(sales.service_fees) });
    payoutRows.push({ label: 'DSR:Alternative Fees', amount: 0 });
    payoutRows.push({ label: 'DSR:House Pymts', amount: 0 });
    payoutRows.push({ label: 'DSR:Liquor Adj Sales', amount: parseFloat(sales.net_sales) - parseFloat(comps.comp_total) });
    payoutRows.push({ label: 'DSR:Valet Parking', amount: 0 });

    // Collection fields — CC by station
    const stationLabelMap = { BAR1: 'CC Bar 1', BAR2: 'CC Bar 2', BAR5: 'CC SVC' };
    stationCC.forEach(s => {
      const label = stationLabelMap[s.station_code];
      if (label) {
        payoutRows.push({ label, amount: parseFloat(s.cc_total) });
      }
    });

    // Cash Deposit = cash sales - paid outs
    payoutRows.push({ label: 'Cash Deposit', amount: parseFloat(payments.cash_sales) - totalPaidOuts });

    // Expense rows from paid outs (category → daily_payouts label)
    paidOuts.forEach(po => {
      const mapping = PAIDOUT_CATEGORIES.find(c => c.category === po.category);
      if (mapping) {
        payoutRows.push({
          label: mapping.label,
          amount: parseFloat(po.total),
        });
      }
    });

    // ── 9. Push to Supabase daily_payouts ──
    let syncResult = { pushed: 0, errors: [] };

    if (supabaseAdmin) {
      const upsertData = payoutRows.map(r => ({
        date: businessDate,
        day_of_week: dayOfWeek,
        label: r.label,
        amount: r.amount,
      }));

      const { error } = await supabaseAdmin
        .from('daily_payouts')
        .upsert(upsertData, { onConflict: 'date,label' });

      if (error) {
        syncResult.errors.push(error.message);
        console.error('[day-close] daily_payouts upsert error:', error.message);
      } else {
        syncResult.pushed = upsertData.length;
        console.log(`[day-close] pushed ${upsertData.length} rows to daily_payouts for ${businessDate}`);
      }
    } else {
      syncResult.errors.push('Supabase admin client not configured — P&L data saved locally only');
    }

    // ── 10. Response ──
    res.json({
      session,
      summary: {
        date: businessDate,
        day_of_week: dayOfWeek,
        net_sales: parseFloat(sales.net_sales),
        sales_tax: parseFloat(sales.sales_tax),
        total_tips: parseFloat(payments.total_tips),
        card_sales: parseFloat(payments.card_sales),
        card_tips: parseFloat(payments.card_tips),
        cash_sales: parseFloat(payments.cash_sales),
        cash_tips: parseFloat(payments.cash_tips),
        comp_total: parseFloat(comps.comp_total),
        order_count: parseInt(sales.order_count),
        void_count: parseInt(sales.void_count),
        paid_outs: totalPaidOuts,
        cash_deposit: parseFloat(payments.cash_sales) - totalPaidOuts,
      },
      daily_payouts: payoutRows,
      sync: syncResult,
    });
  } catch (err) {
    console.error('[day-close] error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET SESSION SUMMARY (for reports) ──
router.get('/summary', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    // Sales
    const { rows: [sales] } = await pool.query(`
      SELECT
        COALESCE(SUM(o.subtotal) FILTER (WHERE o.state IN ('paid','closed')), 0) as net_sales,
        COALESCE(SUM(o.tax_amount) FILTER (WHERE o.state IN ('paid','closed')), 0) as sales_tax,
        COALESCE(SUM(o.auto_grat_amt) FILTER (WHERE o.state IN ('paid','closed')), 0) as service_fees,
        COUNT(DISTINCT o.id) FILTER (WHERE o.state IN ('paid','closed')) as order_count,
        COUNT(DISTINCT o.id) FILTER (WHERE o.state = 'voided') as void_count
      FROM pos_orders o
      WHERE o.opened_at::date = $1
    `, [date]);

    // Payments
    const { rows: [payments] } = await pool.query(`
      SELECT
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'cash'), 0) as cash_sales,
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'card'), 0) as card_sales,
        COALESCE(SUM(p.tip_amount), 0) as total_tips
      FROM pos_payments p
      JOIN pos_orders o ON o.id = p.order_id
      WHERE o.opened_at::date = $1 AND o.state IN ('paid','closed')
    `, [date]);

    // Comps
    const { rows: [comps] } = await pool.query(`
      SELECT COALESCE(SUM(l.price * l.qty), 0) as comp_total
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE o.opened_at::date = $1 AND l.state = 'comped'
    `, [date]);

    // Paid outs
    const { rows: paidOuts } = await pool.query(
      `SELECT category, SUM(amount) as total, COUNT(*) as count
       FROM pos_paid_outs WHERE recorded_at::date = $1 GROUP BY category ORDER BY category`,
      [date]
    );

    const totalPaidOuts = paidOuts.reduce((s, r) => s + parseFloat(r.total), 0);

    res.json({
      date,
      net_sales: parseFloat(sales.net_sales),
      sales_tax: parseFloat(sales.sales_tax),
      service_fees: parseFloat(sales.service_fees),
      total_tips: parseFloat(payments.total_tips),
      card_sales: parseFloat(payments.card_sales),
      cash_sales: parseFloat(payments.cash_sales),
      comp_total: parseFloat(comps.comp_total),
      order_count: parseInt(sales.order_count),
      void_count: parseInt(sales.void_count),
      paid_outs: paidOuts.map(p => ({
        category: p.category,
        total: parseFloat(p.total),
        count: parseInt(p.count),
      })),
      total_paid_outs: totalPaidOuts,
      cash_deposit: parseFloat(payments.cash_sales) - totalPaidOuts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
