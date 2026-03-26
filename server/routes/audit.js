const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// ── GET audit log (voids, comps, discounts) ─────────────────
// GET /api/audit?type=void|comp|all&date_from=...&date_to=...&server_id=...
router.get('/', async (req, res) => {
  try {
    const { type, date_from, date_to, server_id, limit, offset } = req.query;
    const params = [];
    let conditions = [];

    // Build union query for voids and comps
    let query = `
      SELECT
        l.id,
        'void' as audit_type,
        l.name as item_name,
        l.price,
        l.qty,
        l.void_reason as reason,
        l.voided_by as action_by,
        l.voided_at as action_at,
        o.order_num,
        o.tab_name,
        o.server_name,
        o.station_code,
        o.opened_at as order_date
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE l.state = 'voided' AND l.voided_at IS NOT NULL

      UNION ALL

      SELECT
        l.id,
        'comp' as audit_type,
        l.name as item_name,
        l.price,
        l.qty,
        l.comp_reason as reason,
        l.comped_by as action_by,
        l.comped_at as action_at,
        o.order_num,
        o.tab_name,
        o.server_name,
        o.station_code,
        o.opened_at as order_date
      FROM pos_order_lines l
      JOIN pos_orders o ON o.id = l.order_id
      WHERE l.state = 'comped' AND l.comped_at IS NOT NULL

      UNION ALL

      SELECT
        o.id,
        'tab_void' as audit_type,
        o.tab_name as item_name,
        o.total as price,
        1 as qty,
        o.void_reason as reason,
        o.voided_by as action_by,
        o.voided_at as action_at,
        o.order_num,
        o.tab_name,
        o.server_name,
        o.station_code,
        o.opened_at as order_date
      FROM pos_orders o
      WHERE o.state = 'voided' AND o.voided_at IS NOT NULL
    `;

    // Wrap in outer query for filtering and sorting
    let outerQuery = `SELECT * FROM (${query}) AS audit WHERE 1=1`;

    if (type && type !== 'all') {
      if (type === 'void') {
        params.push('void');
        params.push('tab_void');
        outerQuery += ` AND (audit_type = $${params.length - 1} OR audit_type = $${params.length})`;
      } else {
        params.push(type);
        outerQuery += ` AND audit_type = $${params.length}`;
      }
    }
    if (date_from) {
      params.push(date_from);
      outerQuery += ` AND action_at::date >= $${params.length}`;
    }
    if (date_to) {
      params.push(date_to);
      outerQuery += ` AND action_at::date <= $${params.length}`;
    }

    outerQuery += ' ORDER BY action_at DESC';

    const lim = Math.min(parseInt(limit) || 200, 500);
    const off = parseInt(offset) || 0;
    params.push(lim, off);
    outerQuery += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(outerQuery, params);
    res.json({ entries: rows, limit: lim, offset: off });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET audit summary stats ─────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { date } = req.query;
    const dateFilter = date ? 'AND voided_at::date = $1' : '';
    const dateFilterComp = date ? 'AND comped_at::date = $1' : '';
    const dateFilterOrder = date ? 'AND voided_at::date = $1' : '';
    const params = date ? [date] : [];

    const voids = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(price * qty), 0) as total
       FROM pos_order_lines WHERE state = 'voided' ${dateFilter}`, params
    );
    const comps = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(price * qty), 0) as total
       FROM pos_order_lines WHERE state = 'comped' ${dateFilterComp}`, params
    );
    const tabVoids = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
       FROM pos_orders WHERE state = 'voided' ${dateFilterOrder}`, params
    );

    res.json({
      voids: { count: parseInt(voids.rows[0].count), total: parseFloat(voids.rows[0].total) },
      comps: { count: parseInt(comps.rows[0].count), total: parseFloat(comps.rows[0].total) },
      tab_voids: { count: parseInt(tabVoids.rows[0].count), total: parseFloat(tabVoids.rows[0].total) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
