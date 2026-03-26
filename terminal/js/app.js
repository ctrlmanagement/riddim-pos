/* RIDDIM POS Terminal — Core Application
   Phase 2: Supabase-connected — live menu, staff, config
   S75: Replaced hardcoded data with database queries */

'use strict';

// ═══════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════

const SUPABASE_URL = 'https://cbvryfgrqzdvbqigyrgh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fQlHFhC7tPkZNRl1djnvcA_68LpKQpv';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ═══════════════════════════════════════════
// CONFIGURATION — loaded from Supabase
// ═══════════════════════════════════════════

let CONFIG = {
  tax_rate: 0.089,
  default_tip_pct: 0.20,
  require_manager_void: true,
  require_manager_comp: true,
  require_manager_discount: true,
  max_discount_pct: 0.50,
};

let STATION = { id: null, code: 'BAR1', label: 'Bar 1', pos: 'POS 1' };
let STAFF = [];
let MENU_CATEGORIES = [];
let MENU_ITEMS = [];
let STATIONS = [];

// ═══════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════

async function loadConfig() {
  const { data, error } = await sb.from('pos_config').select('*').limit(1).single();
  if (data) {
    CONFIG.tax_rate = parseFloat(data.tax_rate) || 0.089;
    CONFIG.default_tip_pct = parseFloat(data.default_tip_pct) || 0.20;
    CONFIG.require_manager_void = data.require_manager_void;
    CONFIG.require_manager_comp = data.require_manager_comp;
    CONFIG.require_manager_discount = data.require_manager_discount;
    CONFIG.max_discount_pct = parseFloat(data.max_discount_pct) || 0.50;
  }
  if (error) console.error('Config load error:', error);
}

async function loadStaff() {
  const { data, error } = await sb
    .from('staff')
    .select('id, first_name, last_name, phone, role, pos_pin, pos_role, active')
    .eq('active', true)
    .not('pos_pin', 'is', null);
  if (data) {
    STAFF = data.map(s => ({
      id: s.id,
      name: s.first_name + (s.last_name ? ' ' + s.last_name.charAt(0) + '.' : ''),
      fullName: s.first_name + ' ' + (s.last_name || ''),
      pin: s.pos_pin,
      role: s.pos_role || 'bartender',
    }));
  }
  if (error) console.error('Staff load error:', error);
}

async function loadCategories() {
  const { data, error } = await sb
    .from('pos_menu_categories')
    .select('id, name, sort_order, color')
    .eq('active', true)
    .order('sort_order');
  if (data) {
    MENU_CATEGORIES = data.map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      sortOrder: c.sort_order,
    }));
  }
  if (error) console.error('Categories load error:', error);
}

async function loadMenuItems() {
  const { data, error } = await sb
    .from('pos_menu_items')
    .select('id, name, price, category_id, speed_rail, sort_order, inv_product_id')
    .eq('active', true)
    .order('sort_order');
  if (data) {
    MENU_ITEMS = data.map(i => ({
      id: i.id,
      name: i.name,
      price: parseFloat(i.price),
      cat: i.category_id,
      speedRail: i.speed_rail,
      sortOrder: i.sort_order,
      invProductId: i.inv_product_id,
    }));
  }
  if (error) console.error('Menu items load error:', error);
}

async function loadStations() {
  const { data, error } = await sb
    .from('pos_stations')
    .select('id, code, label, pos_name')
    .eq('active', true)
    .order('code');
  if (data) {
    STATIONS = data;
    // Default to first station if none selected
    if (STATIONS.length > 0 && !STATION.id) {
      setStation(STATIONS[0]);
    }
  }
  if (error) console.error('Stations load error:', error);
}

function setStation(s) {
  STATION = { id: s.id, code: s.code, label: s.label, pos: s.pos_name || '' };
}

async function loadAllData() {
  await Promise.all([
    loadConfig(),
    loadStaff(),
    loadCategories(),
    loadMenuItems(),
    loadStations(),
    typeof loadTableMinimums === 'function' ? loadTableMinimums() : Promise.resolve(),
  ]);
}

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════

let currentUser = null;
let tabs = [];
let activeTabId = null;
let activeCategory = null; // set after categories load
let nextTabNum = 1;

// ═══════════════════════════════════════════
// SCREEN MANAGEMENT
// ═══════════════════════════════════════════

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════

let pinBuffer = '';

function initLogin() {
  pinBuffer = '';
  updatePinDots();
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginStation').textContent = STATION.label + (STATION.pos ? ' — ' + STATION.pos : '');

  // Show station selector if multiple stations
  renderStationSelector();
}

function renderStationSelector() {
  const el = document.getElementById('stationSelector');
  if (!el || STATIONS.length <= 1) return;
  el.innerHTML = STATIONS.map(s =>
    `<button class="station-btn ${s.code === STATION.code ? 'active' : ''}"
            onclick="pickStation('${s.code}')">${s.label}</button>`
  ).join('');
}

function pickStation(code) {
  const s = STATIONS.find(st => st.code === code);
  if (s) {
    setStation(s);
    document.getElementById('loginStation').textContent = STATION.label + (STATION.pos ? ' — ' + STATION.pos : '');
    renderStationSelector();
  }
}

function pinPress(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  updatePinDots();
  if (pinBuffer.length === 4) {
    setTimeout(attemptLogin, 200);
  }
}

function pinClear() {
  pinBuffer = '';
  updatePinDots();
  document.getElementById('loginError').textContent = '';
}

function updatePinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinBuffer.length);
  });
}

function attemptLogin() {
  const user = STAFF.find(s => s.pin === pinBuffer);
  if (user) {
    currentUser = user;
    document.getElementById('loginError').textContent = '';
    enterTerminal();
  } else {
    document.getElementById('loginError').textContent = STAFF.length === 0
      ? 'No staff configured — add POS PINs in Owner portal'
      : 'Invalid PIN';
    pinBuffer = '';
    updatePinDots();
  }
}

// ═══════════════════════════════════════════
// TERMINAL — Main Screen
// ═══════════════════════════════════════════

function enterTerminal() {
  showScreen('main');
  document.getElementById('topBarUser').textContent = currentUser.name;
  document.getElementById('topBarStation').textContent = STATION.label;
  updateManagementAccess();

  // Set first category as active
  if (MENU_CATEGORIES.length > 0 && !activeCategory) {
    activeCategory = MENU_CATEGORIES[0].id;
  }

  renderCategories();
  renderMenu();
  renderTabs();
  renderCart();
  startClock();

  // Load table data and show tables view by default
  loadTableData().then(() => {
    switchView('tables');
  });
}

function logout() {
  currentUser = null;
  showScreen('login');
  initLogin();
}

// Clock
let clockInterval;
function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  const tick = () => {
    const now = new Date();
    document.getElementById('topBarClock').textContent =
      now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };
  tick();
  clockInterval = setInterval(tick, 10000);
}

// ═══════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════

function renderCategories() {
  const bar = document.getElementById('categoryBar');
  bar.innerHTML = MENU_CATEGORIES.map(c =>
    `<button class="cat-btn ${c.id === activeCategory ? 'active' : ''}"
            onclick="selectCategory('${c.id}')"
            ${c.color ? `style="color:${c.id === activeCategory ? '' : c.color}"` : ''}>
      ${c.name}
    </button>`
  ).join('');
}

function selectCategory(catId) {
  activeCategory = catId;
  renderCategories();
  renderMenu();
}

// ═══════════════════════════════════════════
// MENU GRID
// ═══════════════════════════════════════════

function renderMenu() {
  const grid = document.getElementById('menuGrid');
  const items = MENU_ITEMS.filter(i => i.cat === activeCategory);
  grid.innerHTML = items.map(item => {
    const is86 = typeof isItem86 === 'function' && isItem86(item.id);
    return `<div class="menu-item ${item.speedRail ? 'speed-rail' : ''} ${is86 ? 'eighty-sixed' : ''}"
          onclick="${is86 ? 'showToast(\'Item is 86\\\'d\')' : 'addToCart(\'' + item.id + '\')'}">
      <span class="menu-item-name">${item.name}</span>
      <span class="menu-item-price">${is86 ? '86' : '$' + item.price}</span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
// TAB MANAGEMENT
// ═══════════════════════════════════════════

function createTab(name, type = 'bar') {
  const num = nextTabNum++;
  const tab = {
    id: 'tab-' + Date.now(),
    num: num,
    name: name || 'Tab ' + num,
    type: type,
    memberId: null,
    tableNum: null,
    discount: false,
    discountPct: 0,
    discountFlat: 0,
    discountBy: null,
    autoGrat: 0,
    guestCount: 1,
    lines: [],
    status: 'open',
    createdAt: new Date(),
    createdBy: currentUser.id,
    station: STATION.code,
  };
  tabs.push(tab);
  activeTabId = tab.id;
  renderTabs();
  renderCart();
  closeModal('newTabModal');
  return tab;
}

function selectTab(tabId) {
  activeTabId = tabId;
  renderTabs();
  renderCart();
}

function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

function renderTabs() {
  const strip = document.getElementById('tabStrip');
  const openTabs = tabs.filter(t => t.status === 'open' || t.status === 'sent');
  strip.innerHTML = openTabs.map(t => {
    const total = tabSubtotal(t);
    return `<div class="tab-chip ${t.id === activeTabId ? 'active' : ''}"
                onclick="selectTab('${t.id}')">
      <span>${t.name}</span>
      ${total > 0 ? `<span class="tab-total">$${total.toFixed(0)}</span>` : ''}
    </div>`;
  }).join('') +
  `<div class="new-tab-btn" onclick="openNewTabModal()">+</div>`;
}

// ═══════════════════════════════════════════
// CART / ORDER LINES
// ═══════════════════════════════════════════

function addToCart(menuItemId) {
  let tab = getActiveTab();
  if (!tab) {
    tab = createTab();
  }

  const item = MENU_ITEMS.find(i => i.id === menuItemId);
  if (!item) return;

  // Get current seat assignment
  const seat = typeof getCurrentSeat === 'function' ? getCurrentSeat() : null;

  // Check if same unsent item exists on same seat — increment qty
  const existing = tab.lines.find(l =>
    l.menuItemId === menuItemId && l.status === 'pending' && !l.voided && l.seat === seat
  );

  if (existing) {
    existing.qty += 1;
  } else {
    tab.lines.push({
      id: 'line-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
      seat: seat,
      status: 'pending',
      voided: false,
      comped: false,
      invProductId: item.invProductId || null,
      addedAt: new Date(),
      addedBy: currentUser.id,
    });
  }

  renderCart();
  renderTabs();
}

function removeLine(lineId) {
  const tab = getActiveTab();
  if (!tab) return;
  const line = tab.lines.find(l => l.id === lineId);
  if (!line) return;

  if (line.status === 'pending') {
    tab.lines = tab.lines.filter(l => l.id !== lineId);
  } else {
    // Already sent — needs void
    if (CONFIG.require_manager_void && currentUser.role !== 'manager') {
      showToast('Manager PIN required to void sent items');
      return;
    }
    line.voided = true;
    line.status = 'voided';
  }

  renderCart();
  renderTabs();
}

function tabSubtotal(tab) {
  return tab.lines
    .filter(l => !l.voided && !l.comped)
    .reduce((sum, l) => sum + (l.price * l.qty), 0);
}

function tabDiscountAmount(tab) {
  if (!tab.discount) return 0;
  const sub = tabSubtotal(tab);
  if (tab.discountPct) return sub * tab.discountPct;
  if (tab.discountFlat) return Math.min(tab.discountFlat, sub);
  return 0;
}

function tabTax(tab) {
  return (tabSubtotal(tab) - tabDiscountAmount(tab)) * CONFIG.tax_rate;
}

function tabTotal(tab) {
  const sub = tabSubtotal(tab);
  const disc = tabDiscountAmount(tab);
  const afterDiscount = sub - disc;
  const tax = afterDiscount * CONFIG.tax_rate;
  const grat = tab.autoGrat ? afterDiscount * tab.autoGrat : 0;
  return afterDiscount + tax + grat;
}

function renderCart() {
  const tab = getActiveTab();
  const itemsEl = document.getElementById('cartItems');
  const headerEl = document.getElementById('cartTabName');
  const typeEl = document.getElementById('cartTabType');
  const totalsEl = document.getElementById('cartTotals');
  const fireBtn = document.getElementById('btnFire');
  const payBtn = document.getElementById('btnPay');
  const holdBtn = document.getElementById('btnHold');
  const voidBtn = document.getElementById('btnVoid');
  const editBtn = document.getElementById('btnEditCheck');

  if (!tab) {
    headerEl.textContent = 'NO TAB';
    typeEl.textContent = '';
    itemsEl.innerHTML = '<div class="cart-empty">Tap + to open a tab</div>';
    totalsEl.innerHTML = '';
    fireBtn.disabled = true;
    payBtn.disabled = true;
    holdBtn.disabled = true;
    voidBtn.disabled = true;
    if (editBtn) editBtn.style.display = 'none';
    return;
  }

  headerEl.textContent = tab.name;
  typeEl.textContent = tab.type.toUpperCase() + ' TAB';
  if (editBtn) editBtn.style.display = '';

  // Bottle service: guest count + min spend bar (injected above cart items)
  let cartExtras = '';
  if (typeof renderGuestCountBar === 'function') cartExtras += renderGuestCountBar(tab);
  if (typeof renderMinSpendBar === 'function') cartExtras += renderMinSpendBar(tab);

  // Group lines by seat if any lines have seats
  const hasSeats = tab.lines.some(l => l.seat);

  // Lines
  if (tab.lines.length === 0) {
    itemsEl.innerHTML = cartExtras + '<div class="cart-empty">Add items from the menu</div>';
  } else {
    let html = '';
    if (hasSeats) {
      // Group by seat
      const seatGroups = {};
      const noSeat = [];
      tab.lines.forEach(l => {
        if (l.seat) {
          if (!seatGroups[l.seat]) seatGroups[l.seat] = [];
          seatGroups[l.seat].push(l);
        } else {
          noSeat.push(l);
        }
      });

      // Render no-seat items first
      if (noSeat.length > 0) {
        html += noSeat.map(l => renderCartLine(l)).join('');
      }
      // Then each seat group
      const seats = Object.keys(seatGroups).sort((a, b) => a - b);
      seats.forEach(s => {
        html += `<div class="cart-seat-divider">SEAT ${s}</div>`;
        html += seatGroups[s].map(l => renderCartLine(l)).join('');
      });
    } else {
      html = tab.lines.map(l => renderCartLine(l)).join('');
    }
    itemsEl.innerHTML = cartExtras + html;
  }

  // Totals
  const sub = tabSubtotal(tab);
  const discountAmt = tabDiscountAmount(tab);
  const afterDiscount = sub - discountAmt;
  const tax = afterDiscount * CONFIG.tax_rate;
  const gratAmt = tab.autoGrat ? afterDiscount * tab.autoGrat : 0;
  const total = afterDiscount + tax + gratAmt;
  const taxPct = (CONFIG.tax_rate * 100).toFixed(1);

  let totalsHtml = `<div class="cart-total-row"><span>Subtotal</span><span>$${sub.toFixed(2)}</span></div>`;
  if (discountAmt > 0) {
    const discLabel = tab.discountPct ? (tab.discountPct * 100).toFixed(0) + '% off' : '$' + tab.discountFlat.toFixed(2) + ' off';
    totalsHtml += `<div class="cart-total-row discount"><span>Discount (${discLabel})</span><span>-$${discountAmt.toFixed(2)}</span></div>`;
  }
  totalsHtml += `<div class="cart-total-row"><span>Tax (${taxPct}%)</span><span>$${tax.toFixed(2)}</span></div>`;
  if (gratAmt > 0) {
    totalsHtml += `<div class="cart-total-row grat"><span>Auto-Grat (${(tab.autoGrat * 100).toFixed(0)}%)</span><span>$${gratAmt.toFixed(2)}</span></div>`;
  }
  totalsHtml += `<div class="cart-total-row grand"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>`;
  totalsEl.innerHTML = totalsHtml;

  // Button states
  const hasPending = tab.lines.some(l => l.status === 'pending' && !l.voided);
  const hasLines = tab.lines.some(l => !l.voided);
  fireBtn.disabled = !hasPending;
  payBtn.disabled = !hasLines;
  holdBtn.disabled = !hasLines;
  voidBtn.disabled = false;
}

function renderCartLine(l) {
  const classes = ['cart-line'];
  if (l.voided) classes.push('voided');
  if (l.comped) classes.push('comped');
  if (l.status === 'sent' || l.status === 'preparing' || l.status === 'ready') classes.push('sent');

  return `<div class="${classes.join(' ')}" onclick="removeLine('${l.id}')">
    <span class="cart-line-qty">${l.qty}x</span>
    <span class="cart-line-name">
      ${l.name}
      ${l.seat ? '<span class="seat-badge">S' + l.seat + '</span>' : ''}
      ${l.status !== 'pending' && !l.voided ? '<span class="sent-badge">' + l.status.toUpperCase() + '</span>' : ''}
      ${l.comped ? '<span class="sent-badge" style="background:var(--orange)">COMP</span>' : ''}
    </span>
    <span class="cart-line-price">${l.voided || l.comped ? '—' : '$' + (l.price * l.qty).toFixed(2)}</span>
  </div>`;
}

// ═══════════════════════════════════════════
// FIRE (send to KDS)
// ═══════════════════════════════════════════

function fireOrder() {
  const tab = getActiveTab();
  if (!tab) return;

  tab.lines.forEach(l => {
    if (l.status === 'pending' && !l.voided) {
      l.status = 'sent';
      l.sentAt = new Date();
    }
  });

  tab.status = 'sent';
  renderCart();
  renderTabs();

  // Visual feedback
  const btn = document.getElementById('btnFire');
  btn.textContent = 'SENT';
  btn.style.background = '#1E8449';
  setTimeout(() => {
    btn.textContent = 'FIRE';
    btn.style.background = '';
  }, 1200);
}

// ═══════════════════════════════════════════
// PAYMENT
// ═══════════════════════════════════════════

let selectedPayMethod = 'card';
let selectedTip = 0;

function openPayment() {
  const tab = getActiveTab();
  if (!tab) return;

  selectedPayMethod = 'card';
  // If auto-grat is set, skip manual tip
  selectedTip = tab.autoGrat ? 0 : CONFIG.default_tip_pct;
  updatePayMethodButtons();
  updateTipButtons();
  openModal('paymentModal');
}

function selectPayMethod(method) {
  selectedPayMethod = method;
  updatePayMethodButtons();
}

function updatePayMethodButtons() {
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.method === selectedPayMethod);
  });
}

function selectTip(pct) {
  selectedTip = pct;
  updateTipButtons();
}

function updateTipButtons() {
  document.querySelectorAll('.tip-btn').forEach(btn => {
    btn.classList.toggle('selected', parseFloat(btn.dataset.tip) === selectedTip);
  });

  const tab = getActiveTab();
  if (!tab) return;
  const base = tabTotal(tab); // already includes discount, tax, auto-grat
  const sub = tabSubtotal(tab) - tabDiscountAmount(tab);
  const tip = tab.autoGrat ? 0 : sub * selectedTip; // no manual tip if auto-grat
  const grand = base + tip;
  document.getElementById('payAmountValue').textContent = '$' + grand.toFixed(2);
}

function submitPayment() {
  const tab = getActiveTab();
  if (!tab) return;

  tab.status = 'paid';
  tab.paidAt = new Date();
  tab.payMethod = selectedPayMethod;
  const tipBase = tabSubtotal(tab) - tabDiscountAmount(tab);
  tab.tipPct = tab.autoGrat || selectedTip;
  tab.tipAmount = tab.autoGrat ? tipBase * tab.autoGrat : tipBase * selectedTip;

  // Mark all lines served
  tab.lines.forEach(l => {
    if (!l.voided && l.status !== 'voided') {
      l.status = 'served';
    }
  });

  // Close tab after payment recorded
  tab.status = 'closed';
  tab.closedAt = new Date();

  // Clear from active
  activeTabId = null;
  const openTabs = tabs.filter(t => t.status === 'open' || t.status === 'sent');
  if (openTabs.length > 0) {
    activeTabId = openTabs[0].id;
  }

  closeModal('paymentModal');
  renderTabs();
  renderCart();
}

// ═══════════════════════════════════════════
// HOLD / VOID
// ═══════════════════════════════════════════

function holdTab() {
  const tab = getActiveTab();
  if (!tab) return;

  activeTabId = null;
  const openTabs = tabs.filter(t => (t.status === 'open' || t.status === 'sent') && t.id !== tab.id);
  if (openTabs.length > 0) {
    activeTabId = openTabs[0].id;
  }

  renderTabs();
  renderCart();
}

function voidTab() {
  const tab = getActiveTab();
  if (!tab) return;

  if (CONFIG.require_manager_void && currentUser.role !== 'manager') {
    showToast('Manager PIN required to void tab');
    return;
  }

  tab.status = 'voided';
  tab.voidedAt = new Date();
  tab.voidedBy = currentUser.id;
  tab.lines.forEach(l => {
    l.voided = true;
    l.status = 'voided';
  });

  activeTabId = null;
  const openTabs = tabs.filter(t => t.status === 'open' || t.status === 'sent');
  if (openTabs.length > 0) {
    activeTabId = openTabs[0].id;
  }

  renderTabs();
  renderCart();
}

// ═══════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;font-family:"Bebas Neue",sans-serif;font-size:16px;letter-spacing:1px;z-index:9999;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ═══════════════════════════════════════════
// NEW TAB MODAL
// ═══════════════════════════════════════════

function openNewTabModal() {
  document.getElementById('newTabName').value = '';
  openModal('newTabModal');
  setTimeout(() => document.getElementById('newTabName').focus(), 100);
}

function createNamedTab() {
  const name = document.getElementById('newTabName').value.trim();
  createTab(name);
}

function createQuickTab(type) {
  if (type === 'bar') {
    createTab('Bar ' + nextTabNum, 'bar');
  } else if (type === 'walkin') {
    createTab('Walk-in ' + nextTabNum, 'bar');
  } else if (type === 'member') {
    // TODO: member lookup from Supabase
    createTab('Member', 'member');
  } else if (type === 'table') {
    closeModal('newTabModal');
    switchView('tables');
    return;
  }
}

// ═══════════════════════════════════════════
// MODAL MANAGEMENT
// ═══════════════════════════════════════════

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ═══════════════════════════════════════════
// KEYBOARD SUPPORT (for dev — physical keyboard)
// ═══════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  // Login screen PIN entry
  if (document.getElementById('screen-login').classList.contains('active')) {
    if (e.key >= '0' && e.key <= '9') pinPress(e.key);
    if (e.key === 'Backspace') pinClear();
    return;
  }

  // New tab modal — Enter to create
  if (document.getElementById('newTabModal').classList.contains('active')) {
    if (e.key === 'Enter') createNamedTab();
    if (e.key === 'Escape') closeModal('newTabModal');
    return;
  }

  // Payment modal — Escape to close
  if (document.getElementById('paymentModal').classList.contains('active')) {
    if (e.key === 'Escape') closeModal('paymentModal');
    return;
  }

  // Recall tabs modal — Escape to close
  if (document.getElementById('recallTabsModal').classList.contains('active')) {
    if (e.key === 'Escape') closeModal('recallTabsModal');
    return;
  }
});

// ═══════════════════════════════════════════
// INIT — Load from Supabase, then show login
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  // Show loading state
  document.getElementById('loginError').textContent = 'Loading...';

  try {
    await loadAllData();
    console.log(`POS loaded: ${STAFF.length} staff, ${MENU_CATEGORIES.length} categories, ${MENU_ITEMS.length} items, ${STATIONS.length} stations`);
  } catch (err) {
    console.error('Failed to load POS data:', err);
    document.getElementById('loginError').textContent = 'Connection error — check network';
    return;
  }

  showScreen('login');
  initLogin();
});
