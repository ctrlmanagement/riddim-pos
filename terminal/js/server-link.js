/* RIDDIM POS — Local Server Link */
'use strict';

// ═══════════════════════════════════════════
// Socket.IO + REST API connection to local server
// Mirrors in-memory state to PostgreSQL for persistence
// and syncs across multiple terminals in real time
// ═══════════════════════════════════════════

const POS_SERVER_CANDIDATES = [
  window.location.origin,     // same origin when served by local server
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
let SERVER_URL = null;
let socket = null;
let serverConnected = false;

// ── INIT ────────────────────────────────────────────────────
async function initServerLink() {
  if (typeof io === 'undefined') {
    console.warn('Socket.IO client not loaded — running without server link');
    updateConnectionBadge(false);
    return;
  }

  // Detect which server URL responds
  for (const url of POS_SERVER_CANDIDATES) {
    try {
      const res = await fetch(url + '/api/health', { signal: AbortSignal.timeout(1500) });
      if (res.ok) { SERVER_URL = url; break; }
    } catch(e) { /* try next */ }
  }

  if (!SERVER_URL) {
    console.warn('No POS server found — running without server link');
    updateConnectionBadge(false);
    return;
  }

  console.log('POS server detected at:', SERVER_URL);
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
  if (!serverConnected || !SERVER_URL) return null;
  try {
    const res = await fetch(SERVER_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error('Server POST failed:', path, res.status, errBody);
      return errBody.error ? { error: errBody.error } : null;
    }
    return await res.json();
  } catch (err) {
    console.error('Server POST error:', path, err);
    return null;
  }
}

async function serverGet(path) {
  if (!serverConnected || !SERVER_URL) return null;
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
    booking_id: tab.bookingId || null,
    session_id: tab.sessionId || null,
  });
  if (order) {
    tab.serverId = order.id; // link in-memory tab to server order
    tab.orderNum = order.order_num; // sequential order number for receipts
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
  if (result) {
    // Capture sale number from payment record
    if (result.payments && result.payments.length) {
      const lastPayment = result.payments[result.payments.length - 1];
      tab.saleNum = lastPayment.sale_num;
    }
    if (socket) socket.emit('order:paid', result);
  }
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

// ── PRICE OVERRIDE ──────────────────────────────────────────
async function serverPriceOverride(tab, line, newPrice, reason) {
  if (!tab.serverId || !line.serverLineId) return null;
  return await serverPost(`/api/orders/${tab.serverId}/lines/${line.serverLineId}/price`, {
    new_price: newPrice,
    staff_id: currentUser.id,
    staff_name: currentUser.name,
    reason,
  });
}

// ── TIP ADJUSTMENT ──────────────────────────────────────────
async function serverTipAdjust(tab, newTip) {
  if (!tab.serverId) return null;
  return await serverPost(`/api/orders/${tab.serverId}/tip`, {
    new_tip: newTip,
    staff_id: currentUser.id,
    staff_name: currentUser.name,
  });
}

// ── AUDIT LOG (generic) ─────────────────────────────────────
async function serverAuditLog(type, detail, reason) {
  return await serverPost('/api/audit', {
    audit_type: type,
    order_id: detail.order_id || null,
    line_id: detail.line_id || null,
    staff_id: currentUser.id,
    staff_name: currentUser.name,
    detail,
    reason,
  });
}

// ── 86 BROADCAST ────────────────────────────────────────────
function server86Toggle(itemId, is86) {
  if (socket) socket.emit('86:toggle', { itemId, is86 });
}

// ── HYDRATE TABS FROM SERVER ────────────────────────────────
// Load today's orders from local PG and populate the in-memory tabs array
async function hydrateTabsFromServer() {
  // Try serverGet first, fall back to direct fetch if not connected yet
  let data = await serverGet('/api/orders/today/all');
  if (!data && SERVER_URL) {
    try {
      const res = await fetch(SERVER_URL + '/api/orders/today/all');
      if (res.ok) data = await res.json();
    } catch(e) { /* no server */ }
  }
  if (!data || !Array.isArray(data)) return 0;

  let loaded = 0;
  for (const order of data) {
    // Skip if already in tabs (e.g. created this session)
    if (tabs.find(t => t.serverId === order.id)) continue;

    // Map server order → in-memory tab
    const tab = {
      id: 'tab-srv-' + order.id,
      serverId: order.id,
      num: order.order_num || 0,
      orderNum: order.order_num,
      name: order.tab_name || 'Order #' + order.order_num,
      type: order.table_num ? 'table' : 'bar',
      memberId: order.member_id || null,
      tableNum: order.table_num || null,
      discount: parseFloat(order.discount_pct) > 0 || parseFloat(order.discount_flat) > 0,
      discountPct: parseFloat(order.discount_pct) || 0,
      discountFlat: parseFloat(order.discount_flat) || 0,
      discountBy: order.discount_by || null,
      autoGrat: parseFloat(order.auto_grat_pct) || 0,
      guestCount: order.customer_count || 1,
      lines: (order.lines || []).map(l => ({
        id: 'line-srv-' + l.id,
        serverLineId: l.id,
        menuItemId: l.menu_item_id,
        name: l.name,
        price: parseFloat(l.price),
        qty: l.qty,
        seat: l.seat || null,
        status: l.state || 'pending',
        voided: l.state === 'voided',
        comped: l.state === 'comped',
        voidReason: l.void_reason,
        compReason: l.comp_reason,
        invProductId: l.inv_product_id,
        addedAt: new Date(l.added_at || l.created_at),
        addedBy: l.added_by,
      })),
      status: mapServerState(order.state),
      createdAt: new Date(order.opened_at || order.created_at),
      createdBy: order.server_id,
      station: order.station_code,
      closedAt: order.closed_at ? new Date(order.closed_at) : null,
      paidAt: order.paid_at ? new Date(order.paid_at) : null,
      voidedAt: order.voided_at ? new Date(order.voided_at) : null,
      bookingId: order.booking_id || null,
      sessionId: order.session_id || null,
      voidReason: order.void_reason || null,
    };

    // Extract payment info from server payments
    if (order.payments && order.payments.length > 0) {
      const lastPay = order.payments[order.payments.length - 1];
      tab.payMethod = lastPay.method;
      tab.tipAmount = parseFloat(lastPay.tip_amount) || 0;
      tab.saleNum = lastPay.sale_num;
    }

    tabs.push(tab);
    loaded++;

    // Track highest tab number for nextTabNum
    if (tab.num >= nextTabNum) nextTabNum = tab.num + 1;
  }

  return loaded;
}

function mapServerState(state) {
  if (state === 'paid' || state === 'closed') return 'closed';
  if (state === 'voided') return 'voided';
  if (state === 'held') return 'open';
  if (state === 'sent') return 'sent';
  return 'open';
}
