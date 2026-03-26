/* RIDDIM POS — Seats + Bottle Service */
'use strict';

// ═══════════════════════════════════════════
// SEAT NUMBERS — assign items to seats
// ═══════════════════════════════════════════

let activeSeat = 0; // 0 = no seat (ALL)

function selectSeat(num) {
  activeSeat = num;
  document.querySelectorAll('.seat-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.seat) === activeSeat);
  });
}

function getCurrentSeat() {
  return activeSeat || null;
}


// ═══════════════════════════════════════════
// BOTTLE SERVICE — min spend tracking + guest count
// ═══════════════════════════════════════════

let tableMinimums = []; // loaded from Supabase table_minimums

async function loadTableMinimums() {
  const { data, error } = await sb
    .from('table_minimums')
    .select('section_name, party_size_min, party_size_max, minimum_spend, minimum_type, table_numbers, is_active')
    .eq('is_active', true);

  if (data) tableMinimums = data;
  if (error) console.error('Table minimums load error:', error);
}

function getMinSpendForTab(tab) {
  if (!tab || !tab.tableNum) return null;

  const section = typeof getSectionForTable === 'function' ? getSectionForTable(tab.tableNum) : null;
  if (!section) return null;

  const guests = tab.guestCount || 1;

  // Find matching minimum
  const match = tableMinimums.find(m => {
    if (m.section_name !== section) return false;
    if (m.table_numbers && m.table_numbers.length > 0 && !m.table_numbers.includes(tab.tableNum)) return false;
    if (guests < m.party_size_min || guests > m.party_size_max) return false;
    return true;
  });

  if (!match) return null;

  const total = match.minimum_type === 'per_person' ? match.minimum_spend * guests : match.minimum_spend;
  return { amount: total, type: match.minimum_type, perPerson: match.minimum_spend };
}

function renderMinSpendBar(tab) {
  const min = getMinSpendForTab(tab);
  if (!min) return '';

  const spent = tabSubtotal(tab);
  const pct = Math.min((spent / min.amount) * 100, 100);
  const met = spent >= min.amount;
  const fillClass = met ? 'met' : pct >= 75 ? 'close' : 'under';

  return `
    <div class="min-spend-bar">
      <span class="min-spend-label">MIN SPEND</span>
      <div class="min-spend-track">
        <div class="min-spend-fill ${fillClass}" style="width:${pct}%"></div>
      </div>
      <span class="min-spend-val ${met ? 'met' : ''}">$${spent.toFixed(0)} / $${min.amount.toFixed(0)}</span>
    </div>`;
}

function renderGuestCountBar(tab) {
  if (!tab || !tab.tableNum) return '';

  const count = tab.guestCount || 1;
  return `
    <div class="btl-guest-row">
      <span class="btl-guest-label">GUESTS</span>
      <button class="btl-guest-btn" onclick="adjustGuests(-1)">-</button>
      <span class="btl-guest-count">${count}</span>
      <button class="btl-guest-btn" onclick="adjustGuests(1)">+</button>
    </div>`;
}

function adjustGuests(delta) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.guestCount = Math.max(1, (tab.guestCount || 1) + delta);
  renderCart();
}
