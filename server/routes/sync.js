const express = require('express');
const router = express.Router();
const sync = require('../sync');

// GET /api/sync/status — sync daemon health + pending counts
router.get('/status', (req, res) => {
  res.json(sync.getStats());
});

// POST /api/sync/trigger — force an immediate sync cycle
router.post('/trigger', async (req, res) => {
  try {
    await sync.runSync();
    res.json({ ok: true, stats: sync.getStats() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
