/* RIDDIM POS — Tables / Floor Plan Module
   31-table floor plan, table-to-tab linking, recall tabs
   Pulls reservations from Supabase table_bookings + table_sessions */

'use strict';

// ═══════════════════════════════════════════
// TABLE SECTION MAP (canonical from RIDDIM)
// ═══════════════════════════════════════════

const TABLE_SECTION_MAP = {
  front:  [1, 2, 3, 4, 5, 6],
  mid:    [7, 8, 9, 10, 11],
  center: [12, 13, 14, 15, 16, 17, 18, 19],
  second: [20, 21, 22, 23, 24],
  top:    [25, 26, 27, 28, 29, 30, 31],
};

const SECTION_LABELS = {
  front:  'Front Booths (1–6)',
  mid:    'Mid Row (7–11)',
  center: 'Center Cluster (12–19)',
  second: 'Second Row (20–24)',
  top:    'Top Row + Lounge (25–31)',
};

function getSectionForTable(num) {
  for (const [section, tables] of Object.entries(TABLE_SECTION_MAP)) {
    if (tables.includes(num)) return section;
  }
  return null;
}

// ═══════════════════════════════════════════
// FLOOR PLAN STATE
// ═══════════════════════════════════════════

let tableReservations = {}; // tableNum -> reservation data
let tableSessions = {};     // tableNum -> session data

// ═══════════════════════════════════════════
// LOAD TABLE DATA FROM SUPABASE
// ═══════════════════════════════════════════

async function loadTableData() {
  const today = new Date().toLocaleDateString('en-CA');

  // Load active table_sessions (seated guests)
  const { data: sessions } = await sb
    .from('table_sessions')
    .select('table_number, guest_name, party_size, server_name, seated_at, status, booking_id')
    .in('status', ['seated', 'active'])
    .order('seated_at');

  tableSessions = {};
  if (sessions) {
    sessions.forEach(s => {
      tableSessions[s.table_number] = s;
    });
  }

  // Load today's reservations (confirmed bookings not yet seated)
  const { data: bookings } = await sb
    .from('table_bookings')
    .select('table_number, guest_name, party_size, status, notes')
    .eq('status', 'confirmed')
    .not('table_number', 'is', null);

  tableReservations = {};
  if (bookings) {
    bookings.forEach(b => {
      if (b.table_number && !tableSessions[b.table_number]) {
        tableReservations[b.table_number] = b;
      }
    });
  }
}

// ═══════════════════════════════════════════
// UPDATE FLOOR PLAN VISUALS
// ═══════════════════════════════════════════

function updateFloorPlan() {
  const svg = document.getElementById('posFloorPlan');
  if (!svg) return;

  let occupiedCount = 0;
  let reservedCount = 0;

  // Build map of table tabs (POS tabs linked to table numbers)
  const tableTabs = {};
  tabs.forEach(t => {
    if (t.tableNum && (t.status === 'open' || t.status === 'sent')) {
      tableTabs[t.tableNum] = t;
    }
  });

  svg.querySelectorAll('.fp-table').forEach(el => {
    const num = parseInt(el.dataset.table);

    // Remove old state classes and badges
    el.classList.remove('occupied', 'reserved');
    el.classList.add('available');
    const oldBadge = el.querySelector('.fp-badge');
    if (oldBadge) oldBadge.remove();

    // Check if table has an active POS tab
    if (tableTabs[num]) {
      el.classList.remove('available');
      el.classList.add('occupied');
      occupiedCount++;

      // Show tab total as badge
      const tab = tableTabs[num];
      const total = tabSubtotal(tab);
      if (total > 0) {
        const rect = el.querySelector('rect');
        const x = parseFloat(rect.getAttribute('x')) + parseFloat(rect.getAttribute('width')) / 2;
        const y = parseFloat(rect.getAttribute('y')) + parseFloat(rect.getAttribute('height')) - 4;
        const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        badge.classList.add('fp-badge');
        badge.setAttribute('x', x);
        badge.setAttribute('y', y);
        badge.setAttribute('text-anchor', 'middle');
        badge.textContent = '$' + total.toFixed(0);
        el.appendChild(badge);
      }
    }
    // Check Supabase session (seated via staff portal, no POS tab yet)
    else if (tableSessions[num]) {
      el.classList.remove('available');
      el.classList.add('occupied');
      occupiedCount++;
    }
    // Check reservation
    else if (tableReservations[num]) {
      el.classList.remove('available');
      el.classList.add('reserved');
      reservedCount++;
    }
  });

  // Update stats
  const total = 31;
  document.getElementById('tblStatTotal').textContent = total;
  document.getElementById('tblStatOccupied').textContent = occupiedCount;
  document.getElementById('tblStatReserved').textContent = reservedCount;
  document.getElementById('tblStatAvail').textContent = total - occupiedCount - reservedCount;

  // Update active tables list
  renderActiveTablesList(tableTabs);
}

function renderActiveTablesList(tableTabs) {
  const list = document.getElementById('activeTablesList');
  const activeTables = [];

  // POS tabs linked to tables
  for (const [num, tab] of Object.entries(tableTabs)) {
    const total = tabSubtotal(tab);
    const section = getSectionForTable(parseInt(num));
    const sectionLabel = SECTION_LABELS[section] || '';
    const timeAgo = getTimeAgo(tab.createdAt);
    activeTables.push({
      num: parseInt(num),
      name: tab.name,
      total,
      meta: sectionLabel.split('(')[0].trim() + ' — ' + timeAgo,
      tabId: tab.id,
    });
  }

  // Supabase sessions without POS tabs
  for (const [num, session] of Object.entries(tableSessions)) {
    if (tableTabs[num]) continue; // already shown
    const section = getSectionForTable(parseInt(num));
    const sectionLabel = SECTION_LABELS[section] || '';
    activeTables.push({
      num: parseInt(num),
      name: 'Table ' + num + (session.guest_name ? ' — ' + session.guest_name : ''),
      total: 0,
      meta: sectionLabel.split('(')[0].trim() + (session.server_name ? ' — ' + session.server_name : ''),
      tabId: null,
    });
  }

  if (activeTables.length === 0) {
    list.innerHTML = '<div class="tables-active-empty">No tables occupied</div>';
    return;
  }

  activeTables.sort((a, b) => a.num - b.num);

  list.innerHTML = activeTables.map(t =>
    `<div class="tables-active-row" onclick="tableClick(${t.num})">
      <div>
        <div class="tables-active-name">Table ${t.num}${t.name && !t.name.startsWith('Table') ? ' — ' + t.name : ''}</div>
        <div class="tables-active-meta">${t.meta}</div>
      </div>
      ${t.total > 0 ? `<div class="tables-active-total">$${t.total.toFixed(0)}</div>` : ''}
    </div>`
  ).join('');
}

function getTimeAgo(date) {
  if (!date) return '';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return diff + 'm';
  return Math.floor(diff / 60) + 'h ' + (diff % 60) + 'm';
}

// ═══════════════════════════════════════════
// TABLE CLICK — open/select tab for table
// ═══════════════════════════════════════════

function tableClick(tableNum) {
  // Check if there's already an open POS tab for this table
  const existing = tabs.find(t =>
    t.tableNum === tableNum && (t.status === 'open' || t.status === 'sent')
  );

  if (existing) {
    // Select the existing tab and switch to terminal
    activeTabId = existing.id;
    renderTabs();
    renderCart();
    switchView('terminal');
    return;
  }

  // Create a new tab linked to this table
  const section = getSectionForTable(tableNum);
  const tab = createTab('Table ' + tableNum, 'table');
  tab.tableNum = tableNum;
  tab.section = section;

  // If there's a Supabase session for this table, link it
  if (tableSessions[tableNum]) {
    const session = tableSessions[tableNum];
    tab.sessionId = session.id;
    if (session.guest_name) {
      tab.name = 'T' + tableNum + ' — ' + session.guest_name;
    }
    if (session.booking_id) {
      tab.bookingId = session.booking_id;
    }
  }

  renderTabs();
  renderCart();
  switchView('terminal');
}

// ═══════════════════════════════════════════
// FAST BAR — skip to terminal, no table
// ═══════════════════════════════════════════

function fastBar() {
  // Switch to terminal view without linking a table
  switchView('terminal');
}

// ═══════════════════════════════════════════
// RECALL TABS — show all open/held tabs
// ═══════════════════════════════════════════

function openRecallTabs() {
  const openTabs = tabs.filter(t => t.status === 'open' || t.status === 'sent');

  const list = document.getElementById('recallTabsList');
  if (openTabs.length === 0) {
    list.innerHTML = '<div class="recall-tabs-empty">No open tabs</div>';
    openModal('recallTabsModal');
    return;
  }

  list.innerHTML = openTabs.map(t => {
    const total = tabTotal(t);
    const items = t.lines.filter(l => !l.voided).length;
    const timeAgo = getTimeAgo(t.createdAt);
    return `<div class="recall-tab-row" onclick="recallTab('${t.id}')">
      <div class="recall-tab-info">
        <div class="recall-tab-name">${t.name}</div>
        <div class="recall-tab-meta">${items} items — ${t.type} — ${timeAgo}</div>
      </div>
      <div class="recall-tab-total">${total > 0 ? '$' + total.toFixed(2) : ''}</div>
    </div>`;
  }).join('');

  openModal('recallTabsModal');
}

function recallTab(tabId) {
  activeTabId = tabId;
  closeModal('recallTabsModal');
  renderTabs();
  renderCart();
  switchView('terminal');
}
