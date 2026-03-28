#!/usr/bin/env node
/* RIDDIM POS — Print Agent
 *
 * Lightweight service for terminals without the full POS server.
 * Listens on port 3001 and drives the local RP-630 USB printer.
 *
 * Deployed on: TERM03 (10.77.2.68)
 * Controlled by: systemd (riddim-print-agent.service)
 *
 * Usage:  node agent.js
 * Test:   curl -X POST http://localhost:3001/print/test
 */
'use strict';

const http = require('http');
const escpos = require('./escpos');

const PORT = process.env.PRINT_AGENT_PORT || 3001;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = req.url.split('?')[0];

  try {
    if (req.method === 'GET' && url === '/print/status') {
      return json(res, 200, { connected: escpos.isOpen() });
    }

    if (req.method === 'POST' && url === '/print/test') {
      await escpos.testPrint();
      return json(res, 200, { status: 'ok', message: 'Test page printed' });
    }

    if (req.method === 'POST' && url === '/print/receipt') {
      const body = await parseBody(req);
      if (!body.tab) return json(res, 400, { status: 'error', message: 'tab required' });
      await escpos.printReceipt(body.tab, body.config || {});
      return json(res, 200, { status: 'ok' });
    }

    if (req.method === 'POST' && url === '/print/open-drawer') {
      await escpos.openDrawer();
      return json(res, 200, { status: 'ok' });
    }

    json(res, 404, { status: 'error', message: 'not found' });
  } catch (e) {
    console.error('[print-agent]', e.message);
    json(res, 500, { status: 'error', message: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[print-agent] listening on port ${PORT}`);
  if (escpos.open()) {
    console.log('[print-agent] RP-630 connected');
  } else {
    console.warn('[print-agent] RP-630 not found — will retry on first print');
  }
});
