const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Paid out categories → daily_payouts label mapping
const PAIDOUT_CATEGORIES = [
  { category: 'Security',              label: 'Security Co. #1' },
  { category: 'Security #2',           label: 'Security Co. #2' },
  { category: 'Police',                label: 'Apd' },
  { category: 'Shift Pay',             label: 'Bar Shift Pay #1' },
  { category: 'Shift Pay #2',          label: 'Bar Shift Pay #2' },
  { category: 'Barbacks',              label: 'Barbacks' },
  { category: 'Sweeps',                label: 'Sweeper' },
  { category: 'Hookah Staff',          label: 'Hookah' },
  { category: 'Incidentals/Supplies',  label: 'Bar Supplies' },
  { category: 'Cashier',               label: 'Cashier' },
  { category: 'DJ Opening',            label: 'DJ #1 (opening)' },
  { category: 'DJ Closing',            label: 'DJ #2 (closing)' },
  { category: 'Promoters',             label: 'Promoters' },
  { category: 'Cleaning',              label: 'Cleaners' },
  { category: 'Host Table',            label: 'Hostess' },
  { category: 'Table Percentage',      label: 'Tbl Line' },
  { category: 'Manager',               label: 'Manager 1' },
  { category: 'Manager #2',            label: 'Manager 2' },
  { category: 'Kitchen',               label: 'Kitchen' },
  { category: 'VIP Host',              label: 'Misc #1' },
  { category: 'Photo',                 label: 'Misc #2' },
];

// GET /api/paid-outs/categories — list valid categories
router.get('/categories', (req, res) => {
  res.json(PAIDOUT_CATEGORIES);
});

// GET /api/paid-outs — list paid outs for a date or session
router.get('/', async (req, res) => {
  try {
    const { date, session_id } = req.query;
    let query = 'SELECT * FROM pos_paid_outs';
    const conditions = [];
    const params = [];

    if (session_id) {
      params.push(session_id);
      conditions.push(`session_id = $${params.length}`);
    }
    if (date) {
      params.push(date);
      conditions.push(`recorded_at::date = $${params.length}`);
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY recorded_at DESC';

    const { rows } = await pool.query(query, params);

    // Include running total
    const total = rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

    res.json({ paid_outs: rows, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/paid-outs — record a paid out
router.post('/', async (req, res) => {
  try {
    const { category, amount, notes, staff_id, staff_name, station_code, session_id } = req.body;

    if (!category || !amount || !staff_id || !staff_name) {
      return res.status(400).json({ error: 'category, amount, staff_id, and staff_name required' });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    // Validate category
    const valid = PAIDOUT_CATEGORIES.find(c => c.category === category);
    if (!valid) {
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }

    const { rows: [row] } = await pool.query(
      `INSERT INTO pos_paid_outs (category, amount, notes, staff_id, staff_name, station_code, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [category, amountNum, notes || null, staff_id, staff_name, station_code || null, session_id || null]
    );

    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/paid-outs/:id — void a paid out (manager only)
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM pos_paid_outs WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Paid out not found' });
    }

    res.json({ deleted: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.PAIDOUT_CATEGORIES = PAIDOUT_CATEGORIES;
