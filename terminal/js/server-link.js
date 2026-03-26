/* RIDDIM POS — Local Server Link */
'use strict';

// ═══════════════════════════════════════════
// Socket.IO + REST API connection to local server
// Mirrors in-memory state to PostgreSQL for persistence
// and syncs across multiple terminals in real time
// ═══════════════════════════════════════════

const SERVER_URL = window.location.origin; // same origin when served by local server
let socket = null;
let serverConnected = false;

// ── INIT ────────────────────────────────────────────────────
function initServerLink() {
  if (typeof io === 'undefined') {
    console.warn('Socket.IO client not loaded — running without server link');
    return;
  }

  socket = io(SERVER_URL);

  socket.on('connect', () => {
    serverConnected = true;
    console.log('Connected to POS server:', socket.id);
    // Join station room
    if (STATION.code) socket.emit('join-station', STATION.code);
    updateConnectionBadge(true);
  });

  socket.on('disconnect', () => {
    serverConnected = false;
    console.warn('Disconnected from POS server');
    updateConnectionBadge(false);
  });

  // ── INCOMING EVENTS FROM OTHER TERMINALS ────────────────

  socket.on('order:created', (order) => {
    // Another terminal created a tab — add to local state if not already present
    if (!tabs.find(t => t.serverId === order.id)) {
      console.log('Remote tab created:', order.tab_name);
    }
  });

  socket.on('order:fired', (data) => {
    console.log('Remote fire event:', data);
  });

  socket.on('order:paid', (order) => {
    console.log('Remote payment:', order.tab_name);
  });

  socket.on('order:voided', (order) => {
    console.log('Remote void:', order.tab_name);
  });

  socket.on('86:toggle', (data) => {
    // Another terminal toggled 86 — update local state
    if (typeof toggle86Remote === 'function') {
      toggle86Remote(data.itemId, data.is86);
    }
  });

  socket.on('clock:in', (data) => {
    clockEntries.push({ staffId: data.staff_id, staffName: data.staff_name, type: 'in', time: new Date(data.time) });
  });

  socket.on('clock:out', (data) => {
    clockEntries.push({ staffId: data.staff_id, staffName: data.staff_name, type: 'out', time: new Date(data.time) });
  });
}

// ── CONNECTION BADGE ────────────────────────────────────────
function updateConnectionBadge(connected) {
  let badge = document.getElementById('serverBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'serverBadge';
    badge.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;font-family:"Bebas Neue",sans-serif;font-size:10px;letter-spacing:1px;padding:3px 8px;border-radius:4px;pointer-events:none;';
    document.body.appendChild(badge);
  }
  badge.textContent = connected ? 'SERVER' : 'OFFLINE';
  badge.style.background = connected ? 'rgba(76,175,80,0.2)' : 'rgba(192,57,43,0.2)';
  badge.style.color = connected ? '#4CAF50' : '#C0392B';
  badge.style.border = connected ? '1px solid rgba(76,175,80,0.4)' : '1px solid rgba(192,57,43,0.4)';
}

// ── REST API HELPERS ────────────────────────────────────────
async function serverPost(path, body) {
  if (!serverConnected) return null;
  try {
    const res = await fetch(SERVER_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Server POST failed:', path, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Server POST error:', path, err);
    return null;
  }
}

async function serverGet(path) {
  if (!serverConnected) return null;
  try {
    const res = await fetch(SERVER_URL + path);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Server GET error:', path, err);
    return null;
  }
}

// ── ORDER PERSISTENCE ───────────────────────────────────────

// Mirror tab creation to server
async function serverCreateOrder(tab) {
  const order = await serverPost('/api/orders', {
    tab_name: tab.name,
    table_num: tab.tableNum || null,
    member_id: tab.memberId || null,
    server_id: currentUser.id,
    server_name: currentUser.name,
    station_code: STATION.code,
    customer_count: tab.guestCount || 1,
  });
  if (order) {
    tab.serverId = order.id; // link in-memory tab to server order
    if (socket) socket.emit('order:created', order);
  }
  return order;
}

// Mirror line additions to server
async function serverAddLines(tab, newLines) {
  if (!tab.serverId) return null;
  const lines = newLines.map(l => ({
    menu_item_id: l.menuItemId || null,
    name: l.name,
    price: l.price,
    qty: l.qty,
    seat: l.seat || null,
    inv_product_id: l.invProductId || null,
    added_by: currentUser.id,
  }));
  const result = await serverPost(`/api/orders/${tab.serverId}/lines`, { lines });
  // Map server line IDs back to in-memory lines
  if (result && Array.isArray(result)) {
    result.forEach((serverLine, i) => {
      if (newLines[i]) newLines[i].serverLineId = serverLine.id;
    });
  }
  return result;
}

// Mirror fire to server
async function serverFireOrder(tab) {
  if (!tab.serverId) return null;
  const result = await serverPost(`/api/orders/${tab.serverId}/fire`);
  if (result && socket) socket.emit('order:fired', result);
  return result;
}

// Mirror void line to server
async function serverVoidLine(tab, line, reason) {
  if (!tab.serverId || !line.serverLineId) return null;
  return await serverPost(`/api/orders/${tab.serverId}/lines/${line.serverLineId}/void`, {
    reason,
    voided_by: currentUser.id,
  });
}

// Mirror comp line to server
async function serverCompLine(tab, line, reason) {
  if (!tab.serverId || !line.serverLineId) return null;
  return await serverPost(`/api/orders/${tab.serverId}/lines/${line.serverLineId}/comp`, {
    reason,
    comped_by: currentUser.id,
  });
}

// Mirror void tab to server
async function serverVoidOrder(tab, reason) {
  if (!tab.serverId) return null;
  const result = await serverPost(`/api/orders/${tab.serverId}/void`, {
    reason,
    voided_by: currentUser.id,
  });
  if (result && socket) socket.emit('order:voided', result);
  return result;
}

// Mirror payment to server
async function serverPayOrder(tab, method, amount, tipAmount) {
  if (!tab.serverId) return null;
  const result = await serverPost(`/api/orders/${tab.serverId}/pay`, {
    method,
    amount,
    tip_amount: tipAmount,
    processed_by: currentUser.id,
  });
  if (result && socket) socket.emit('order:paid', result);
  return result;
}

// Mirror hold to server
async function serverHoldOrder(tab) {
  if (!tab.serverId) return null;
  return await serverPost(`/api/orders/${tab.serverId}/hold`);
}

// ── CLOCK PERSISTENCE ───────────────────────────────────────
async function serverClockIn(staffId, staffName) {
  const result = await serverPost('/api/clock/in', {
    staff_id: staffId,
    staff_name: staffName,
    station_code: STATION.code,
  });
  if (result && socket) socket.emit('clock:in', { staff_id: staffId, staff_name: staffName, time: new Date() });
  return result;
}

async function serverClockOut(staffId, forcedBy) {
  const result = await serverPost('/api/clock/out', {
    staff_id: staffId,
    forced_by: forcedBy || null,
  });
  if (result && socket) socket.emit('clock:out', { staff_id: staffId, time: new Date() });
  return result;
}

// ── 86 BROADCAST ────────────────────────────────────────────
function server86Toggle(itemId, is86) {
  if (socket) socket.emit('86:toggle', { itemId, is86 });
}
