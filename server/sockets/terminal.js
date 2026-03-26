const pool = require('../db/pool');

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log(`Terminal connected: ${socket.id}`);

    // Join station room for targeted broadcasts
    socket.on('join-station', (stationCode) => {
      socket.join(`station:${stationCode}`);
      socket.stationCode = stationCode;
      console.log(`  ${socket.id} joined station:${stationCode}`);
    });

    // ── ORDER EVENTS ──────────────────────────────────────

    // New order created — broadcast to all terminals
    socket.on('order:created', (order) => {
      socket.broadcast.emit('order:created', order);
    });

    // Order updated (lines added, state changed, etc.)
    socket.on('order:updated', (order) => {
      socket.broadcast.emit('order:updated', order);
    });

    // Order fired — broadcast to KDS displays
    socket.on('order:fired', (data) => {
      // Broadcast to all (terminals update tab state, KDS shows new tickets)
      socket.broadcast.emit('order:fired', data);
      // Also emit to KDS room
      io.to('kds').emit('kds:new-ticket', data);
    });

    // Order paid/closed
    socket.on('order:paid', (order) => {
      socket.broadcast.emit('order:paid', order);
    });

    // Order voided
    socket.on('order:voided', (order) => {
      socket.broadcast.emit('order:voided', order);
    });

    // ── KDS EVENTS ────────────────────────────────────────

    // KDS display joins its room
    socket.on('join-kds', (station) => {
      socket.join('kds');
      socket.join(`kds:${station}`);
      console.log(`  KDS display ${socket.id} joined kds:${station}`);
    });

    // KDS bumps a ticket (item done)
    socket.on('kds:bump', (data) => {
      // Notify terminals that item is ready
      io.emit('kds:item-ready', data);
    });

    // ── 86 LIST ───────────────────────────────────────────

    // Item 86'd — broadcast to all terminals
    socket.on('86:toggle', (data) => {
      socket.broadcast.emit('86:toggle', data);
    });

    // ── CLOCK ─────────────────────────────────────────────

    socket.on('clock:in', (data) => {
      socket.broadcast.emit('clock:in', data);
    });

    socket.on('clock:out', (data) => {
      socket.broadcast.emit('clock:out', data);
    });

    // ── DISCONNECT ────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log(`Terminal disconnected: ${socket.id}`);
    });
  });
};
