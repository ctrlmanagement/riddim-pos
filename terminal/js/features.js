/* RIDDIM POS — Terminal Features
   86 List, Edit Check, Clock In/Out, Seat Numbers
   Requires app.js loaded first (MENU_ITEMS, CONFIG, tabs, etc.) */

'use strict';

// ═══════════════════════════════════════════
// 86 LIST — Out-of-stock item management
// ═══════════════════════════════════════════

let eightySixSet = new Set(); // Set of menu item IDs that are 86'd

function open86List() {
  document.getElementById('eightySixSearch').value = '';
  render86List();
  openModal('eightySixModal');
}

function render86List() {
  const search = (document.getElementById('eightySixSearch')?.value || '').toLowerCase();
  let items = [...MENU_ITEMS];
  if (search) items = items.filter(i => i.name.toLowerCase().includes(search));

  // Sort: 86'd items first, then alphabetical
  items.sort((a, b) => {
    const a86 = eightySixSet.has(a.id) ? 0 : 1;
    const b86 = eightySixSet.has(b.id) ? 0 : 1;
    if (a86 !== b86) return a86 - b86;
    return a.name.localeCompare(b.name);
  });

  // Get category names
  const catMap = {};
  MENU_CATEGORIES.forEach(c => catMap[c.id] = c.name);

  const list = document.getElementById('eightySixList');
  list.innerHTML = items.map(i => {
    const is86 = eightySixSet.has(i.id);
    return `<div class="eightysix-row ${is86 ? 'is86' : ''}" onclick="toggle86('${i.id}')">
      <div class="eightysix-item">
        <span class="eightysix-name">${i.name}</span>
        <span class="eightysix-cat">${catMap[i.cat] || ''}</span>
      </div>
      <div class="eightysix-toggle">${is86 ? '86' : 'IN'}</div>
    </div>`;
  }).join('');
}

function toggle86(itemId) {
  if (eightySixSet.has(itemId)) {
    eightySixSet.delete(itemId);
  } else {
    eightySixSet.add(itemId);
  }
  render86List();
  update86Badge();
  renderMenu(); // refresh menu grid to grey out 86'd items
}

function update86Badge() {
  const countEl = document.getElementById('btn86Count');
  if (countEl) {
    countEl.textContent = eightySixSet.size > 0 ? '(' + eightySixSet.size + ')' : '';
  }
}

function isItem86(itemId) {
  return eightySixSet.has(itemId);
}


// ═══════════════════════════════════════════
// EDIT CHECK — Comp, Discount, Gratuity, Tab Name
// ═══════════════════════════════════════════

function openEditCheck() {
  const tab = getActiveTab();
  if (!tab) return;
  document.getElementById('ecPanel').innerHTML = '';
  openModal('editCheckModal');
}

// Edit Tab Name
function ecEditTabName() {
  const tab = getActiveTab();
  if (!tab) return;
  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="form-row">
        <label class="form-label">TAB NAME</label>
        <input type="text" id="ecTabNameInput" class="form-input" value="${tab.name}" placeholder="Tab name">
      </div>
      <div class="form-actions">
        <button class="mgmt-action-btn" onclick="ecSaveTabName()">SAVE</button>
      </div>
    </div>`;
  setTimeout(() => {
    const inp = document.getElementById('ecTabNameInput');
    inp.focus();
    inp.select();
  }, 100);
}

function ecSaveTabName() {
  const tab = getActiveTab();
  if (!tab) return;
  const name = document.getElementById('ecTabNameInput').value.trim();
  if (!name) { showToast('Name cannot be empty'); return; }
  tab.name = name;
  closeModal('editCheckModal');
  renderTabs();
  renderCart();
  showToast('Tab renamed');
}

// Comp Item
function ecComp() {
  if (CONFIG.require_manager_comp && currentUser.role !== 'manager' && currentUser.role !== 'owner') {
    showToast('Manager PIN required to comp items');
    return;
  }
  const tab = getActiveTab();
  if (!tab) return;

  const compableLines = tab.lines.filter(l => !l.voided && !l.comped);
  if (compableLines.length === 0) {
    document.getElementById('ecPanel').innerHTML = '<div class="ec-empty">No items to comp</div>';
    return;
  }

  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">SELECT ITEM TO COMP</div>
      ${compableLines.map(l => `
        <div class="ec-line-row" onclick="ecDoComp('${l.id}')">
          <span>${l.qty}x ${l.name}</span>
          <span>$${(l.price * l.qty).toFixed(2)}</span>
        </div>
      `).join('')}
    </div>`;
}

function ecDoComp(lineId) {
  const tab = getActiveTab();
  if (!tab) return;
  const line = tab.lines.find(l => l.id === lineId);
  if (!line) return;

  line.comped = true;
  line.compedBy = currentUser.id;
  line.compedAt = new Date();

  closeModal('editCheckModal');
  renderCart();
  renderTabs();
  showToast(line.name + ' comped');
}

// Discount
function ecDiscount() {
  if (CONFIG.require_manager_discount && currentUser.role !== 'manager' && currentUser.role !== 'owner') {
    showToast('Manager PIN required to apply discount');
    return;
  }
  const tab = getActiveTab();
  if (!tab) return;

  const maxPct = (CONFIG.max_discount_pct * 100).toFixed(0);
  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">APPLY DISCOUNT</div>
      <div class="ec-discount-btns">
        <button class="ec-disc-btn" onclick="ecApplyDiscount(0.10)">10%</button>
        <button class="ec-disc-btn" onclick="ecApplyDiscount(0.15)">15%</button>
        <button class="ec-disc-btn" onclick="ecApplyDiscount(0.20)">20%</button>
        <button class="ec-disc-btn" onclick="ecApplyDiscount(0.25)">25%</button>
        <button class="ec-disc-btn" onclick="ecApplyDiscount(0.50)">50%</button>
        <button class="ec-disc-btn" onclick="ecApplyDiscount(1.00)">100%</button>
      </div>
      <div class="form-row" style="margin-top:12px">
        <label class="form-label">CUSTOM %</label>
        <input type="number" id="ecDiscountPct" class="form-input" min="1" max="${maxPct}" placeholder="Enter %" style="width:100px">
        <button class="mgmt-action-btn" onclick="ecApplyDiscount(parseFloat(document.getElementById('ecDiscountPct').value)/100)" style="margin-left:8px">APPLY</button>
      </div>
      <div class="form-row">
        <label class="form-label">FLAT $ OFF</label>
        <input type="number" id="ecDiscountFlat" class="form-input" min="0" step="0.01" placeholder="$0.00" style="width:100px">
        <button class="mgmt-action-btn" onclick="ecApplyFlatDiscount()" style="margin-left:8px">APPLY</button>
      </div>
      ${tab.discount ? '<div class="ec-current">Current discount: ' + (tab.discountPct ? (tab.discountPct * 100).toFixed(0) + '%' : '$' + tab.discountFlat.toFixed(2)) + ' <button class="ec-remove-btn" onclick="ecRemoveDiscount()">REMOVE</button></div>' : ''}
    </div>`;
}

function ecApplyDiscount(pct) {
  if (!pct || isNaN(pct) || pct <= 0) { showToast('Invalid discount'); return; }
  if (pct > CONFIG.max_discount_pct) {
    showToast('Max discount is ' + (CONFIG.max_discount_pct * 100).toFixed(0) + '%');
    return;
  }
  const tab = getActiveTab();
  if (!tab) return;

  tab.discount = true;
  tab.discountPct = pct;
  tab.discountFlat = 0;
  tab.discountBy = currentUser.id;

  closeModal('editCheckModal');
  renderCart();
  renderTabs();
  showToast((pct * 100).toFixed(0) + '% discount applied');
}

function ecApplyFlatDiscount() {
  const amount = parseFloat(document.getElementById('ecDiscountFlat').value);
  if (!amount || isNaN(amount) || amount <= 0) { showToast('Invalid amount'); return; }

  const tab = getActiveTab();
  if (!tab) return;

  const sub = tabSubtotal(tab);
  if (amount > sub) { showToast('Discount exceeds subtotal'); return; }

  tab.discount = true;
  tab.discountPct = 0;
  tab.discountFlat = amount;
  tab.discountBy = currentUser.id;

  closeModal('editCheckModal');
  renderCart();
  renderTabs();
  showToast('$' + amount.toFixed(2) + ' discount applied');
}

function ecRemoveDiscount() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.discount = false;
  tab.discountPct = 0;
  tab.discountFlat = 0;
  tab.discountBy = null;

  closeModal('editCheckModal');
  renderCart();
  renderTabs();
  showToast('Discount removed');
}

// Auto-Gratuity
function ecGratuity() {
  const tab = getActiveTab();
  if (!tab) return;

  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">AUTO-GRATUITY</div>
      <div class="ec-discount-btns">
        <button class="ec-disc-btn ${tab.autoGrat === 0.18 ? 'selected' : ''}" onclick="ecApplyGrat(0.18)">18%</button>
        <button class="ec-disc-btn ${tab.autoGrat === 0.20 ? 'selected' : ''}" onclick="ecApplyGrat(0.20)">20%</button>
        <button class="ec-disc-btn ${tab.autoGrat === 0.22 ? 'selected' : ''}" onclick="ecApplyGrat(0.22)">22%</button>
        <button class="ec-disc-btn ${tab.autoGrat === 0.25 ? 'selected' : ''}" onclick="ecApplyGrat(0.25)">25%</button>
      </div>
      ${tab.autoGrat ? '<div class="ec-current">Auto-gratuity: ' + (tab.autoGrat * 100).toFixed(0) + '% <button class="ec-remove-btn" onclick="ecRemoveGrat()">REMOVE</button></div>' : ''}
    </div>`;
}

function ecApplyGrat(pct) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.autoGrat = pct;

  closeModal('editCheckModal');
  renderCart();
  showToast('Auto-gratuity ' + (pct * 100).toFixed(0) + '% applied');
}

function ecRemoveGrat() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.autoGrat = 0;

  closeModal('editCheckModal');
  renderCart();
  showToast('Auto-gratuity removed');
}


// ═══════════════════════════════════════════
// CLOCK IN / OUT
// ═══════════════════════════════════════════

let clockPinBuffer = '';
let clockEntries = []; // in-memory log: { staffId, staffName, type: 'in'|'out', time }

function openClockInOut() {
  clockPinBuffer = '';
  updateClockPinDots();
  document.getElementById('clockStatus').textContent = 'Enter your 4-digit PIN';
  document.getElementById('clockResult').innerHTML = '';
  openModal('clockModal');
}

function clockPinPress(digit) {
  if (clockPinBuffer.length >= 4) return;
  clockPinBuffer += digit;
  updateClockPinDots();
  if (clockPinBuffer.length === 4) {
    setTimeout(clockPinSubmit, 200);
  }
}

function clockPinClear() {
  clockPinBuffer = '';
  updateClockPinDots();
  document.getElementById('clockStatus').textContent = 'Enter your 4-digit PIN';
  document.getElementById('clockResult').innerHTML = '';
}

function updateClockPinDots() {
  const dots = document.querySelectorAll('#clockModal .pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < clockPinBuffer.length);
  });
}

function clockPinSubmit() {
  const staff = STAFF.find(s => s.pin === clockPinBuffer);
  if (!staff) {
    document.getElementById('clockStatus').textContent = 'Invalid PIN';
    document.getElementById('clockStatus').style.color = 'var(--red)';
    clockPinBuffer = '';
    updateClockPinDots();
    setTimeout(() => {
      document.getElementById('clockStatus').style.color = '';
      document.getElementById('clockStatus').textContent = 'Enter your 4-digit PIN';
    }, 2000);
    return;
  }

  // Check if currently clocked in
  const lastEntry = [...clockEntries].reverse().find(e => e.staffId === staff.id);
  const isClockedIn = lastEntry && lastEntry.type === 'in';
  const now = new Date();
  const type = isClockedIn ? 'out' : 'in';

  // Record entry
  const entry = {
    staffId: staff.id,
    staffName: staff.name,
    type: type,
    time: now,
  };
  clockEntries.push(entry);

  // Show result
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (type === 'in') {
    document.getElementById('clockResult').innerHTML = `
      <div class="clock-result-card in">
        <div class="clock-result-name">${staff.name}</div>
        <div class="clock-result-action">CLOCKED IN</div>
        <div class="clock-result-time">${timeStr}</div>
      </div>`;
  } else {
    // Calculate shift duration
    const clockInEntry = [...clockEntries].reverse().find(e => e.staffId === staff.id && e.type === 'in' && e.time < now);
    let duration = '';
    if (clockInEntry) {
      const diffMin = Math.floor((now - clockInEntry.time) / 60000);
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      duration = h > 0 ? h + 'h ' + m + 'm' : m + 'm';
    }
    document.getElementById('clockResult').innerHTML = `
      <div class="clock-result-card out">
        <div class="clock-result-name">${staff.name}</div>
        <div class="clock-result-action">CLOCKED OUT</div>
        <div class="clock-result-time">${timeStr}</div>
        ${duration ? '<div class="clock-result-duration">Shift: ' + duration + '</div>' : ''}
      </div>`;
  }

  document.getElementById('clockStatus').textContent = '';
  clockPinBuffer = '';
  updateClockPinDots();

  // Auto-close after 3 seconds
  setTimeout(() => {
    if (document.getElementById('clockModal').classList.contains('active')) {
      closeModal('clockModal');
    }
  }, 3000);
}


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
