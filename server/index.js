require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const pool = require('./db/pool');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(express.json());

// CORS — allow BOH portal (GitHub Pages) and local dev to query the API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── STATIC FILES ────────────────────────────────────────────
// Serve terminal UI
app.use('/terminal', express.static(path.join(__dirname, '..', 'terminal')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
// Serve KDS UI (when built)
app.use('/kds', express.static(path.join(__dirname, '..', 'kds')));

// ── REST ROUTES ─────────────────────────────────────────────
const ordersRouter = require('./routes/orders');
const clockRouter = require('./routes/clock');
const transactionsRouter = require('./routes/transactions');

app.use('/api/orders', ordersRouter);
app.use('/api/clock', clockRouter);
app.use('/api/transactions', transactionsRouter);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT now()');
    res.json({ status: 'ok', time: rows[0].now, uptime: process.uptime() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── SOCKET.IO ───────────────────────────────────────────────
const terminalSocket = require('./sockets/terminal');
terminalSocket(io);

// ── START ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`RIDDIM POS server running on port ${PORT}`);
  console.log(`  Terminal: http://localhost:${PORT}/terminal/`);
  console.log(`  KDS:      http://localhost:${PORT}/kds/`);
  console.log(`  API:      http://localhost:${PORT}/api/health`);
});
