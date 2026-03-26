/* RIDDIM POS — Tables / Floor Plan Module
   31-table floor plan, table-to-tab linking, recall tabs
   Live integration: table_sessions ↔ POS tabs, reservations → seat flow
   S79: Full RIDDIM integration layer */

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

let tableReservations = {}; // tableNum -> booking data (with event info)
let tableSessions = {};     // tableNum -> session data
let tableRefreshTimer = null;

// ═══════════════════════════════════════════
// LOAD TABLE DATA FROM SUPABASE
// ═══════════════════════════════════════════

async function loadTableData() {
  // Load active table_sessions (seated guests)
  const { data: sessions } = await sb
    .from('table_sessions')
    .select('id, table_number, guest_name, guest_phone, party_size, server_id, server_name, seated_at, status, booking_id, member_id, deposit_applied, notes')
    .in('status', ['seated', 'active'])
    .order('seated_at');

  tableSessions = {};
  if (sessions) {
    sessions.forEach(s => {
      tableSessions[s.table_number] = s;
    });
  }

  // Load tonight's reservations (confirmed bookings with assigned tables, not yet seated)
  // Constraint #2: Never JOIN events on table_bookings — query separately
  const { data: bookings } = await sb
    .from('table_bookings')
    .select('id, table_number, guest_name, guest_phone, party_size, status, notes, member_id, minimum_spend_required, deposit_amount, deposit_paid, event_id, section_name, booking_source')
    .eq('status', 'confirmed')
    .not('table_number', 'is', null);

  tableReservations = {};
  if (bookings && bookings.length > 0) {
    // Query events separately — constraint #2
    const eventIds = [...new Set(bookings.map(b => b.event_id).filter(Boolean))];
    let eventsMap = {};
    if (eventIds.length > 0) {
      const { data: events } = await sb
        .from('events')
        .select('id, title, event_date')
        .in('id', eventIds);
      if (events) events.forEach(e => { eventsMap[e.id] = e; });
    }

    bookings.forEach(b => {
      if (b.table_number && !tableSessions[b.table_number]) {
        b._event = eventsMap[b.event_id] || null;
        tableReservations[b.table_number] = b;
      }
    });
  }
}

// Auto-refresh floor plan every 30s when in tables view
function startTableRefresh() {
  stopTableRefresh();
  tableRefreshTimer = setInterval(async () => {
    await loadTableData();
    updateFloorPlan();
  }, 30000);
}

function stopTableRefresh() {
  if (tableRefreshTimer) {
    clearInterval(tableRefreshTimer);
    tableRefreshTimer = null;
  }
}

// ═══════════════════════════════════════════
// TABLE SESSION LIFECYCLE — Supabase sync
// ═══════════════════════════════════════════

// Create a new table_session when a POS tab opens on a table
async function createTableSession(tab) {
  if (!tab.tableNum) return null;

  const payload = {
    table_number: tab.tableNum,
    guest_name: tab.guestName || tab.name || 'Table ' + tab.tableNum,
    guest_phone: tab.guestPhone || null,
    party_size: tab.guestCount || 1,
    server_id: currentUser.id,
    server_name: currentUser.name,
    status: 'seated',
    member_id: tab.memberId || null,
    booking_id: tab.bookingId || null,
    deposit_applied: tab.depositAmount || 0,
    notes: tab.bookingNotes || null,
  };

  const { data, error } = await sb
    .from('table_sessions')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Failed to create table_session:', error);
    return null;
  }

  if (data) {
    tab.sessionId = data.id;
    tableSessions[tab.tableNum] = data;
  }
  return data;
}

// Close table_session when POS tab is paid/closed
async function closeTableSession(tab) {
  if (!tab.sessionId) return;

  const total = typeof tabTotal === 'function' ? tabTotal(tab) : 0;
  const { error } = await sb
    .from('table_sessions')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      payment_amount: total,
    })
    .eq('id', tab.sessionId);

  if (error) {
    console.error('Failed to close table_session:', error);
    return;
  }

  // Clean up local state
  if (tab.tableNum) delete tableSessions[tab.tableNum];
}

// Update booking status to 'seated' when seating from reservation
async function seatReservation(bookingId) {
  const { error } = await sb
    .from('table_bookings')
    .update({ status: 'seated' })
    .eq('id', bookingId);

  if (error) console.error('Failed to update booking status:', error);
}

// Close booking when tab is paid
async function closeBooking(bookingId, paymentAmount) {
  const { error } = await sb
    .from('table_bookings')
    .update({
      status: 'closed',
      payment_amount: paymentAmount,
    })
    .eq('id', bookingId);

  if (error) console.error('Failed to close booking:', error);
}

// Fetch booking details and apply deposit/min spend to a tab
async function applyBookingToTab(tab, bookingId) {
  if (!bookingId) return;

  const { data: booking, error } = await sb
    .from('table_bookings')
    .select('id, guest_name, guest_phone, party_size, minimum_spend_required, deposit_amount, deposit_paid, member_id, section_name, notes')
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    console.error('Failed to load booking:', error);
    return;
  }

  tab.bookingId = booking.id;

  // Transfer min spend from booking
  if (booking.minimum_spend_required) {
    tab.minSpendRequired = parseFloat(booking.minimum_spend_required);
  }

  // Transfer deposit
  if (booking.deposit_paid && booking.deposit_amount) {
    tab.depositAmount = parseFloat(booking.deposit_amount);
  }

  // Transfer guest info if not already set
  if (!tab.guestName && booking.guest_name) tab.guestName = booking.guest_name;
  if (!tab.guestPhone && booking.guest_phone) tab.guestPhone = booking.guest_phone;
  if (!tab.memberId && booking.member_id) tab.memberId = booking.member_id;
  if (booking.party_size) tab.guestCount = booking.party_size;
  if (booking.notes) tab.bookingNotes = booking.notes;

  // Load member details if booking has a member
  if (booking.member_id && !tab.memberName && typeof lookupMemberById === 'function') {
    const member = await lookupMemberById(booking.member_id);
    if (member) {
      tab.memberName = member.first_name + ' ' + (member.last_name || '');
      tab.memberTier = member.tier;
      tab.memberPoints = member.total_points;
    }
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
    const oldInfo = el.querySelector('.fp-info');
    if (oldInfo) oldInfo.remove();

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

  // Update panels
  renderActiveTablesList(tableTabs);
  renderReservationsList();
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
    const minInfo = typeof getMinSpendForTab === 'function' ? getMinSpendForTab(tab) : null;
    activeTables.push({
      num: parseInt(num),
      name: tab.name,
      total,
      meta: sectionLabel.split('(')[0].trim() + ' — ' + timeAgo,
      tabId: tab.id,
      minSpend: minInfo ? minInfo.amount : (tab.minSpendRequired || 0),
      memberName: tab.memberName || null,
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
      minSpend: 0,
      memberName: null,
    });
  }

  if (activeTables.length === 0) {
    list.innerHTML = '<div class="tables-active-empty">No tables occupied</div>';
    return;
  }

  activeTables.sort((a, b) => a.num - b.num);

  list.innerHTML = activeTables.map(t => {
    const minBadge = t.minSpend > 0 ? `<span class="min-badge ${t.total >= t.minSpend ? 'met' : ''}">$${t.total.toFixed(0)}/$${t.minSpend.toFixed(0)}</span>` : '';
    const memberBadge = t.memberName ? `<span class="member-badge">${t.memberName}</span>` : '';
    return `<div class="tables-active-row" onclick="tableClick(${t.num})">
      <div>
        <div class="tables-active-name">Table ${t.num}${t.name && !t.name.startsWith('Table') ? ' — ' + t.name : ''} ${memberBadge}</div>
        <div class="tables-active-meta">${t.meta} ${minBadge}</div>
      </div>
      ${t.total > 0 ? `<div class="tables-active-total">$${t.total.toFixed(0)}</div>` : ''}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
// RESERVATIONS LIST (tonight's bookings)
// ═══════════════════════════════════════════

function renderReservationsList() {
  const list = document.getElementById('reservationsList');
  if (!list) return;

  const reservations = Object.values(tableReservations);
  if (reservations.length === 0) {
    list.innerHTML = '<div class="tables-active-empty">No reservations tonight</div>';
    return;
  }

  // Sort by table number
  reservations.sort((a, b) => a.table_number - b.table_number);

  list.innerHTML = reservations.map(r => {
    const eventName = r._event ? r._event.title : '';
    const minSpend = r.minimum_spend_required ? '$' + parseFloat(r.minimum_spend_required).toFixed(0) + ' min' : '';
    const deposit = r.deposit_paid && r.deposit_amount ? '$' + parseFloat(r.deposit_amount).toFixed(0) + ' deposit' : '';
    const source = r.booking_source === 'member' ? 'MEMBER' : '';
    return `<div class="reservation-row" onclick="seatFromReservation(${r.table_number})">
      <div class="reservation-info">
        <div class="reservation-name">T${r.table_number} — ${r.guest_name}</div>
        <div class="reservation-meta">
          ${r.party_size} guests${r.section_name ? ' — ' + r.section_name : ''}
          ${eventName ? ' — ' + eventName : ''}
        </div>
        <div class="reservation-tags">
          ${minSpend ? `<span class="res-tag">${minSpend}</span>` : ''}
          ${deposit ? `<span class="res-tag deposit">${deposit}</span>` : ''}
          ${source ? `<span class="res-tag member">${source}</span>` : ''}
        </div>
      </div>
      <button class="seat-btn-small" onclick="event.stopPropagation(); seatFromReservation(${r.table_number})">SEAT</button>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
// SEAT FROM RESERVATION — create session + tab
// ═══════════════════════════════════════════

async function seatFromReservation(tableNum) {
  const booking = tableReservations[tableNum];
  if (!booking) {
    showToast('No reservation for table ' + tableNum);
    return;
  }

  // Check if already has a POS tab
  const existing = tabs.find(t =>
    t.tableNum === tableNum && (t.status === 'open' || t.status === 'sent')
  );
  if (existing) {
    activeTabId = existing.id;
    renderTabs();
    renderCart();
    switchView('terminal');
    return;
  }

  // Create POS tab linked to this reservation
  const tabName = 'T' + tableNum + ' — ' + booking.guest_name;
  const tab = await createTab(tabName, 'table');
  tab.tableNum = tableNum;
  tab.section = getSectionForTable(tableNum) || booking.section_name;
  tab.guestCount = booking.party_size || 1;
  tab.guestName = booking.guest_name;
  tab.guestPhone = booking.guest_phone || null;
  tab.bookingId = booking.id;
  tab.bookingNotes = booking.notes || null;
  tab.memberId = booking.member_id || null;

  // Transfer min spend from booking
  if (booking.minimum_spend_required) {
    tab.minSpendRequired = parseFloat(booking.minimum_spend_required);
  }

  // Transfer deposit
  if (booking.deposit_paid && booking.deposit_amount) {
    tab.depositAmount = parseFloat(booking.deposit_amount);
  }

  // Create table_session in Supabase
  await createTableSession(tab);

  // Mark booking as seated
  await seatReservation(booking.id);

  // Move from reservations to sessions in local state
  delete tableReservations[tableNum];

  // If member booking, load member details
  if (booking.member_id) {
    const member = await lookupMemberById(booking.member_id);
    if (member) {
      tab.memberName = member.first_name + ' ' + (member.last_name || '');
      tab.memberTier = member.tier;
      tab.memberPoints = member.total_points;
    }
  }

  renderTabs();
  renderCart();
  updateFloorPlan();
  switchView('terminal');
  showToast('Seated: ' + booking.guest_name + ' — Table ' + tableNum);
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

async function tableClick(tableNum) {
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

  // If there's a confirmed reservation, seat via reservation flow
  if (tableReservations[tableNum]) {
    await seatFromReservation(tableNum);
    return;
  }

  // Walk-in seating — create a new tab linked to this table
  const section = getSectionForTable(tableNum);
  const tab = await createTab('Table ' + tableNum, 'table');
  tab.tableNum = tableNum;
  tab.section = section;

  // If there's a Supabase session for this table (seated via staff portal), link it
  if (tableSessions[tableNum]) {
    const session = tableSessions[tableNum];
    tab.sessionId = session.id;
    if (session.guest_name) {
      tab.name = 'T' + tableNum + ' — ' + session.guest_name;
      tab.guestName = session.guest_name;
    }
    if (session.guest_phone) tab.guestPhone = session.guest_phone;
    if (session.member_id) tab.memberId = session.member_id;
    if (session.party_size) tab.guestCount = session.party_size;

    // Fetch booking deposit/min spend if session is linked to a booking
    if (session.booking_id) {
      await applyBookingToTab(tab, session.booking_id);
    }
  } else {
    // No existing session — create one in Supabase
    await createTableSession(tab);
  }

  renderTabs();
  renderCart();
  updateFloorPlan();
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
    const memberBadge = t.memberName ? `<span class="member-badge">${t.memberName}</span>` : '';
    return `<div class="recall-tab-row" onclick="recallTab('${t.id}')">
      <div class="recall-tab-info">
        <div class="recall-tab-name">${t.name} ${memberBadge}</div>
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
