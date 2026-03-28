/* RIDDIM POS — Printer API Routes */
'use strict';

const express = require('express');
const router = express.Router();
const printer = require('../printer/escpos');

// POST /api/printer/test — test print
router.post('/test', async (req, res) => {
  try {
    await printer.testPrint();
    res.json({ status: 'ok', message: 'Test page printed' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/printer/receipt — print a receipt from tab data
router.post('/receipt', async (req, res) => {
  try {
    const { tab, config } = req.body;
    if (!tab) return res.status(400).json({ status: 'error', message: 'tab required' });
    await printer.printReceipt(tab, config || {});
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/printer/open-drawer — kick the cash drawer
router.post('/open-drawer', async (req, res) => {
  try {
    await printer.openDrawer();
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/printer/status — check if printer is connected
router.get('/status', (req, res) => {
  res.json({ connected: printer.isOpen() });
});

module.exports = router;
