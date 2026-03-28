const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// ── GET active clock entries ────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    let query = 'SELECT * FROM pos_clock_entries';
    if (active === 'true') query += ' WHERE clock_out IS NULL';
    query += ' ORDER BY clock_in DESC';

    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CLOCK IN ────────────────────────────────────────────────
router.post('/in', async (req, res) => {
  try {
    const { staff_id, staff_name, station_code } = req.body;

    // Check if already clocked in
    const existing = await pool.query(
      'SELECT id FROM pos_clock_entries WHERE staff_id = $1 AND clock_out IS NULL',
      [staff_id]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Already clocked in' });
    }

    const { rows } = await pool.query(
      `INSERT INTO pos_clock_entries (staff_id, staff_name, station_code)
       VALUES ($1, $2, $3) RETURNING *`,
      [staff_id, staff_name, station_code]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CLOCK OUT ───────────────────────────────────────────────
router.post('/out', async (req, res) => {
  try {
    const { staff_id, forced_by, declared_tips } = req.body;

    const { rows } = await pool.query(
      `UPDATE pos_clock_entries SET clock_out = now(), forced_out_by = $2, declared_tips = $3
       WHERE staff_id = $1 AND clock_out IS NULL RETURNING *`,
      [staff_id, forced_by || null, declared_tips || 0]
    );

    if (!rows.length) return res.status(404).json({ error: 'No active clock entry' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
