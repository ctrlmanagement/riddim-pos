/* RIDDIM POS — Printer API Routes
 *
 * Routes print jobs to either the local USB printer (TERM02)
 * or a remote print agent (TERM03+) based on request origin.
 *
 * Remote terminals run riddim-print-agent on port 3001.
 * The server detects the client IP and proxies accordingly.
 */
'use strict';

const express = require('express');
const http = require('http');
const router = express.Router();
const printer = require('../printer/escpos');

const PRINT_AGENT_PORT = 3001;

// IPs that have a local printer on this server (no proxy needed)
// Everything else is assumed to have a remote print agent
function isLocal(req) {
  const ip = (req.ip || req.connection.remoteAddress || '').replace('::ffff:', '');
  return ip === '127.0.0.1' || ip === '::1' || ip === '10.77.2.53';
}

function clientIP(req) {
  return (req.ip || req.connection.remoteAddress || '').replace('::ffff:', '');
}

// Proxy a request to a remote print agent
function proxyToAgent(ip, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const opts = {
      hostname: ip,
      port: PRINT_AGENT_PORT,
      path: '/print' + path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 5000,
    };
    const req = http.request(opts, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('error', reject);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { resolve({ status: 'ok', raw: buf }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Print agent timeout')); });
    req.write(data);
    req.end();
  });
}

// POST /api/printer/test — test print
router.post('/test', async (req, res) => {
  try {
    if (isLocal(req)) {
      await printer.testPrint();
      return res.json({ status: 'ok', message: 'Test page printed (local)' });
    }
    const ip = clientIP(req);
    const result = await proxyToAgent(ip, '/test', {});
    res.json({ status: 'ok', message: `Test page printed (remote ${ip})`, agent: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/printer/receipt — print a receipt from tab data
router.post('/receipt', async (req, res) => {
  try {
    const { tab, config } = req.body;
    if (!tab) return res.status(400).json({ status: 'error', message: 'tab required' });
    if (isLocal(req)) {
      await printer.printReceipt(tab, config || {});
      return res.json({ status: 'ok' });
    }
    const ip = clientIP(req);
    const result = await proxyToAgent(ip, '/receipt', { tab, config });
    res.json({ status: 'ok', agent: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/printer/open-drawer — kick the cash drawer
router.post('/open-drawer', async (req, res) => {
  try {
    if (isLocal(req)) {
      await printer.openDrawer();
      return res.json({ status: 'ok' });
    }
    const ip = clientIP(req);
    const result = await proxyToAgent(ip, '/open-drawer', {});
    res.json({ status: 'ok', agent: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/printer/status — check if printer is connected
router.get('/status', async (req, res) => {
  if (isLocal(req)) {
    return res.json({ connected: printer.isOpen(), location: 'local' });
  }
  const ip = clientIP(req);
  try {
    const result = await new Promise((resolve, reject) => {
      const opts = {
        hostname: ip, port: PRINT_AGENT_PORT, path: '/print/status',
        method: 'GET', timeout: 3000,
      };
      const r = http.request(opts, (resp) => {
        let buf = '';
        resp.on('data', c => buf += c);
        resp.on('error', reject);
        resp.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve({ connected: false }); } });
      });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
      r.end();
    });
    res.json({ connected: result.connected, location: `remote:${ip}` });
  } catch {
    res.json({ connected: false, location: `remote:${ip}`, error: 'agent unreachable' });
  }
});

module.exports = router;
