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
    const { closed_by, closed_by_name, date, cash_deposit: manualCashDeposit } = req.body;
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
        COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'deposit'), 0) as deposit_applied,
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
    // closed_by is uuid — validate before inserting, pass null for non-UUID callers (e.g. BOH)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const closedByUuid = uuidRegex.test(closed_by) ? closed_by : null;
    const { rows: [session] } = await pool.query(
      `INSERT INTO pos_sessions (closed_at, closed_by, total_sales, total_tax, total_tips, total_comps, total_voids, order_count)
       VALUES (now(), $1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        closedByUuid,
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
    payoutRows.push({ label: 'DSR:House Pymts', amount: parseFloat(payments.deposit_applied) });
    payoutRows.push({ label: 'DSR:Liquor Adj Sales', amount: +((parseFloat(sales.net_sales) || 0) - (parseFloat(comps.comp_total) || 0)).toFixed(2) });
    payoutRows.push({ label: 'DSR:Valet Parking', amount: 0 });

    // Collection fields — CC by station
    const stationLabelMap = { BAR1: 'CC Bar 1', BAR2: 'CC Bar 2', BAR5: 'CC SVC' };
    stationCC.forEach(s => {
      const label = stationLabelMap[s.station_code];
      if (label) {
        payoutRows.push({ label, amount: parseFloat(s.cc_total) });
      }
    });

    // Cash Deposit — use manually entered amount if provided, otherwise calculate
    const cashInDrawer = (parseFloat(payments.cash_sales) || 0) + (parseFloat(payments.cash_tips) || 0);
    const calculatedDeposit = +(cashInDrawer - totalPaidOuts).toFixed(2);
    const cashDeposit = (manualCashDeposit !== undefined && manualCashDeposit !== null)
      ? parseFloat(manualCashDeposit)
      : calculatedDeposit;
    payoutRows.push({ label: 'Cash Deposit', amount: cashDeposit });

    // Audit trail: log manual cash deposit override
    if (manualCashDeposit !== undefined && manualCashDeposit !== null) {
      const overShort = +(parseFloat(manualCashDeposit) - calculatedDeposit).toFixed(2);
      try {
        await pool.query(
          `INSERT INTO pos_audit_log (audit_type, staff_id, staff_name, detail)
           VALUES ('cash_deposit_override', $1, $2, $3)`,
          [closedByUuid || '00000000-0000-0000-0000-000000000000', closed_by_name || 'unknown',
           JSON.stringify({ calculated: calculatedDeposit, entered: parseFloat(manualCashDeposit), over_short: overShort, date: businessDate })]
        );
      } catch (e) { console.warn('[day-close] audit log insert failed:', e.message); }
    }

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

    // ── 9. Theoretical inventory usage ──
    // Aggregate all fired lines by inv_product_id + station.
    // Comped included (spirit was consumed). Voided excluded (not made).
    // Stock-up lines excluded (handled by inv_stock_ups at fire time).
    let usageResult = { products: 0, errors: [] };

    if (supabaseAdmin) {
      try {
        // Query all order lines with inv_product_id for this day
        const { rows: usageLines } = await pool.query(`
          SELECT
            l.inv_product_id,
            o.station_code,
            SUM(l.qty) as total_qty,
            l.name
          FROM pos_order_lines l
          JOIN pos_orders o ON o.id = l.order_id
          WHERE o.opened_at::date = $1
            AND l.state != 'voided'
            AND l.inv_product_id IS NOT NULL
            AND l.name NOT LIKE 'SU:%'
          GROUP BY l.inv_product_id, o.station_code, l.name
        `, [businessDate]);

        if (usageLines.length > 0) {
          // Fetch std_pour_oz for all products referenced
          const productIds = [...new Set(usageLines.map(l => l.inv_product_id))];
          const { data: products } = await supabaseAdmin
            .from('inv_products')
            .select('id, std_pour_oz')
            .in('id', productIds);

          const pourMap = {};
          (products || []).forEach(p => { pourMap[p.id] = parseFloat(p.std_pour_oz) || 2; });

          // Aggregate by (product, station) — separate pours from bottles
          const usageMap = {}; // key: `${inv_product_id}|${station_code}`
          for (const line of usageLines) {
            const key = `${line.inv_product_id}|${line.station_code || 'UNKNOWN'}`;
            if (!usageMap[key]) {
              usageMap[key] = {
                inv_product_id: line.inv_product_id,
                station_code: line.station_code || 'UNKNOWN',
                pour_qty: 0,
                pour_oz: 0,
                bottle_qty: 0,
                std_pour_oz: pourMap[line.inv_product_id] || 2,
              };
            }
            const qty = parseInt(line.total_qty);
            const isBottle = line.name && line.name.endsWith('(Btl)');
            if (isBottle) {
              usageMap[key].bottle_qty += qty;
            } else {
              usageMap[key].pour_qty += qty;
              usageMap[key].pour_oz += qty * (pourMap[line.inv_product_id] || 2);
            }
          }

          // UPSERT to Supabase
          const usageRows = Object.values(usageMap).map(u => ({
            business_date: businessDate,
            inv_product_id: u.inv_product_id,
            station_code: u.station_code,
            pour_qty: u.pour_qty,
            pour_oz: +u.pour_oz.toFixed(2),
            bottle_qty: u.bottle_qty,
            std_pour_oz: u.std_pour_oz,
          }));

          const { error: usageError } = await supabaseAdmin
            .from('pos_theoretical_usage')
            .upsert(usageRows, { onConflict: 'business_date,inv_product_id,station_code' });

          if (usageError) {
            usageResult.errors.push(usageError.message);
            console.error('[day-close] theoretical usage upsert error:', usageError.message);
          } else {
            usageResult.products = usageRows.length;
            console.log(`[day-close] pushed ${usageRows.length} theoretical usage rows for ${businessDate}`);
          }
        }
      } catch (usageErr) {
        usageResult.errors.push(usageErr.message);
        console.error('[day-close] theoretical usage calc error:', usageErr.message);
      }
    }

    // ── 10. Push to Supabase daily_payouts ──
    // (renumbered from 9 — theoretical usage is now step 9)
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

    // ── 11. Response ──
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
        deposit_applied: parseFloat(payments.deposit_applied),
        comp_total: parseFloat(comps.comp_total),
        order_count: parseInt(sales.order_count),
        void_count: parseInt(sales.void_count),
        paid_outs: totalPaidOuts,
        cash_deposit: cashDeposit,
      },
      daily_payouts: payoutRows,
      sync: syncResult,
      theoretical_usage: usageResult,
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
      cash_deposit: +((parseFloat(payments.cash_sales) || 0) - totalPaidOuts).toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
