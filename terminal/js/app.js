/* RIDDIM POS Terminal — Core Application
   Phase 1: Staff-facing bartender terminal
   Mock data — no server connection yet */

'use strict';

// ═══════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════

const STATION = {
  id: 'BAR1',
  label: 'Bar 1',
  pos: 'POS 1'
};

const TAX_RATE = 0.089; // Atlanta 8.9% sales tax

// ═══════════════════════════════════════════
// MOCK DATA — replaced by server in Phase 2
// ═══════════════════════════════════════════

const STAFF = [
  { id: 's1', name: 'Marcus', pin: '1234', role: 'bartender' },
  { id: 's2', name: 'Aaliyah', pin: '5678', role: 'bartender' },
  { id: 's3', name: 'Devon', pin: '0000', role: 'manager' },
];

const MENU_CATEGORIES = [
  { id: 'rail',      name: 'SPEED RAIL', color: '#D4A843' },
  { id: 'spirits',   name: 'SPIRITS' },
  { id: 'cocktails', name: 'COCKTAILS' },
  { id: 'beer',      name: 'BEER' },
  { id: 'wine',      name: 'WINE' },
  { id: 'hookah',    name: 'HOOKAH' },
  { id: 'food',      name: 'FOOD' },
  { id: 'na',        name: 'N/A' },
];

const MENU_ITEMS = [
  // Speed Rail
  { id: 'm01', name: 'Well Vodka',      price: 10, cat: 'rail', speedRail: true },
  { id: 'm02', name: 'Well Rum',        price: 10, cat: 'rail', speedRail: true },
  { id: 'm03', name: 'Well Tequila',    price: 10, cat: 'rail', speedRail: true },
  { id: 'm04', name: 'Well Whiskey',    price: 10, cat: 'rail', speedRail: true },
  { id: 'm05', name: 'Well Gin',        price: 10, cat: 'rail', speedRail: true },
  { id: 'm06', name: 'House Margarita', price: 14, cat: 'rail', speedRail: true },
  { id: 'm07', name: 'Rum Punch',       price: 14, cat: 'rail', speedRail: true },
  { id: 'm08', name: 'Long Island',     price: 15, cat: 'rail', speedRail: true },

  // Spirits
  { id: 'm10', name: 'Hennessy VS',       price: 14, cat: 'spirits' },
  { id: 'm11', name: 'Hennessy VSOP',     price: 18, cat: 'spirits' },
  { id: 'm12', name: 'D\'usse',           price: 16, cat: 'spirits' },
  { id: 'm13', name: 'Casamigos Blanco',  price: 16, cat: 'spirits' },
  { id: 'm14', name: 'Casamigos Repo',    price: 18, cat: 'spirits' },
  { id: 'm15', name: 'Casamigos Anejo',   price: 20, cat: 'spirits' },
  { id: 'm16', name: 'Don Julio Blanco',  price: 16, cat: 'spirits' },
  { id: 'm17', name: 'Don Julio 1942',    price: 35, cat: 'spirits' },
  { id: 'm18', name: 'Patron Silver',     price: 16, cat: 'spirits' },
  { id: 'm19', name: 'Grey Goose',        price: 16, cat: 'spirits' },
  { id: 'm20', name: 'Belvedere',         price: 16, cat: 'spirits' },
  { id: 'm21', name: 'Ciroc',             price: 15, cat: 'spirits' },
  { id: 'm22', name: 'Jack Daniels',      price: 12, cat: 'spirits' },
  { id: 'm23', name: 'Crown Royal',       price: 13, cat: 'spirits' },
  { id: 'm24', name: 'Johnnie Black',     price: 14, cat: 'spirits' },
  { id: 'm25', name: 'Remy VSOP',         price: 18, cat: 'spirits' },

  // Cocktails
  { id: 'm30', name: 'Riddim Punch',        price: 16, cat: 'cocktails' },
  { id: 'm31', name: 'Smoky Old Fashioned', price: 18, cat: 'cocktails' },
  { id: 'm32', name: 'Espresso Martini',    price: 17, cat: 'cocktails' },
  { id: 'm33', name: 'Hennessy Sour',       price: 16, cat: 'cocktails' },
  { id: 'm34', name: 'Passion Fruit Marg',  price: 16, cat: 'cocktails' },
  { id: 'm35', name: 'Spicy Margarita',     price: 16, cat: 'cocktails' },
  { id: 'm36', name: 'Dark & Stormy',       price: 15, cat: 'cocktails' },
  { id: 'm37', name: 'Mojito',              price: 14, cat: 'cocktails' },

  // Beer
  { id: 'm40', name: 'Heineken',     price: 7,  cat: 'beer' },
  { id: 'm41', name: 'Corona',       price: 7,  cat: 'beer' },
  { id: 'm42', name: 'Stella',       price: 8,  cat: 'beer' },
  { id: 'm43', name: 'Blue Moon',    price: 8,  cat: 'beer' },
  { id: 'm44', name: 'Guinness',     price: 8,  cat: 'beer' },
  { id: 'm45', name: 'Bud Light',    price: 6,  cat: 'beer' },
  { id: 'm46', name: 'Modelo',       price: 7,  cat: 'beer' },

  // Wine
  { id: 'm50', name: 'House Red',      price: 12, cat: 'wine' },
  { id: 'm51', name: 'House White',    price: 12, cat: 'wine' },
  { id: 'm52', name: 'Prosecco Glass', price: 14, cat: 'wine' },
  { id: 'm53', name: 'Rose Glass',     price: 13, cat: 'wine' },
  { id: 'm54', name: 'Moet Bottle',    price: 120, cat: 'wine' },
  { id: 'm55', name: 'Veuve Bottle',   price: 180, cat: 'wine' },
  { id: 'm56', name: 'Ace of Spades',  price: 350, cat: 'wine' },

  // Hookah
  { id: 'm60', name: 'Hookah Single',  price: 25, cat: 'hookah' },
  { id: 'm61', name: 'Hookah Double',  price: 40, cat: 'hookah' },
  { id: 'm62', name: 'Extra Bowl',     price: 15, cat: 'hookah' },

  // Food
  { id: 'm70', name: 'Jerk Wings',       price: 16, cat: 'food' },
  { id: 'm71', name: 'Oxtail Sliders',   price: 18, cat: 'food' },
  { id: 'm72', name: 'Fried Plantains',  price: 10, cat: 'food' },
  { id: 'm73', name: 'Curry Shrimp',     price: 22, cat: 'food' },
  { id: 'm74', name: 'Loaded Fries',     price: 14, cat: 'food' },
  { id: 'm75', name: 'Fish Tacos',       price: 16, cat: 'food' },

  // Non-Alcoholic
  { id: 'm80', name: 'Red Bull',     price: 6, cat: 'na' },
  { id: 'm81', name: 'Water',        price: 3, cat: 'na' },
  { id: 'm82', name: 'Cranberry',    price: 4, cat: 'na' },
  { id: 'm83', name: 'Pineapple',    price: 4, cat: 'na' },
  { id: 'm84', name: 'Ginger Beer',  price: 5, cat: 'na' },
  { id: 'm85', name: 'Soda',         price: 3, cat: 'na' },
];

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════

let currentUser = null;
let tabs = [];
let activeTabId = null;
let activeCategory = 'rail';
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
  document.getElementById('loginStation').textContent = STATION.label + ' — ' + STATION.pos;
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
    document.getElementById('loginError').textContent = 'Invalid PIN';
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
  renderCategories();
  renderMenu();
  renderTabs();
  renderCart();
  startClock();
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
  grid.innerHTML = items.map(item =>
    `<div class="menu-item ${item.speedRail ? 'speed-rail' : ''}"
          onclick="addToCart('${item.id}')">
      <span class="menu-item-name">${item.name}</span>
      <span class="menu-item-price">$${item.price}</span>
    </div>`
  ).join('');
}

// ═══════════════════════════════════════════
// TAB MANAGEMENT
// ═══════════════════════════════════════════

function createTab(name, type = 'bar') {
  const tab = {
    id: 'tab-' + Date.now(),
    num: nextTabNum++,
    name: name || 'Tab ' + nextTabNum,
    type: type, // bar, table, member
    memberId: null,
    tableId: null,
    lines: [],
    status: 'open', // open, sent, paid, closed, voided
    createdAt: new Date(),
    createdBy: currentUser.id,
    station: STATION.id,
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
    // Auto-create tab if none active
    tab = createTab('Tab ' + nextTabNum);
  }

  const item = MENU_ITEMS.find(i => i.id === menuItemId);
  if (!item) return;

  // Check if same unsent item exists — increment qty
  const existing = tab.lines.find(l =>
    l.menuItemId === menuItemId && l.status === 'pending' && !l.voided
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
      status: 'pending', // pending, sent, preparing, ready, served, voided, comped
      voided: false,
      comped: false,
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
    // Not yet sent — just remove
    tab.lines = tab.lines.filter(l => l.id !== lineId);
  } else {
    // Already sent — needs void (manager auth in future)
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

function tabTax(tab) {
  return tabSubtotal(tab) * TAX_RATE;
}

function tabTotal(tab) {
  return tabSubtotal(tab) + tabTax(tab);
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

  if (!tab) {
    headerEl.textContent = 'NO TAB';
    typeEl.textContent = '';
    itemsEl.innerHTML = '<div class="cart-empty">Tap + to open a tab</div>';
    totalsEl.innerHTML = '';
    fireBtn.disabled = true;
    payBtn.disabled = true;
    holdBtn.disabled = true;
    voidBtn.disabled = true;
    return;
  }

  headerEl.textContent = tab.name;
  typeEl.textContent = tab.type.toUpperCase() + ' TAB';

  // Lines
  if (tab.lines.length === 0) {
    itemsEl.innerHTML = '<div class="cart-empty">Add items from the menu</div>';
  } else {
    itemsEl.innerHTML = tab.lines.map(l => {
      const classes = ['cart-line'];
      if (l.voided) classes.push('voided');
      if (l.status === 'sent' || l.status === 'preparing' || l.status === 'ready') classes.push('sent');

      return `<div class="${classes.join(' ')}" onclick="removeLine('${l.id}')">
        <span class="cart-line-qty">${l.qty}x</span>
        <span class="cart-line-name">
          ${l.name}
          ${l.status !== 'pending' && !l.voided ? `<span class="sent-badge">${l.status.toUpperCase()}</span>` : ''}
          ${l.comped ? '<span class="sent-badge" style="background:#F39C12">COMP</span>' : ''}
        </span>
        <span class="cart-line-price">${l.voided ? '—' : '$' + (l.price * l.qty).toFixed(2)}</span>
      </div>`;
    }).join('');
  }

  // Totals
  const sub = tabSubtotal(tab);
  const tax = tabTax(tab);
  const total = tabTotal(tab);

  totalsEl.innerHTML = `
    <div class="cart-total-row"><span>Subtotal</span><span>$${sub.toFixed(2)}</span></div>
    <div class="cart-total-row"><span>Tax (8.9%)</span><span>$${tax.toFixed(2)}</span></div>
    <div class="cart-total-row grand"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>
  `;

  // Button states
  const hasPending = tab.lines.some(l => l.status === 'pending' && !l.voided);
  const hasLines = tab.lines.some(l => !l.voided);
  fireBtn.disabled = !hasPending;
  payBtn.disabled = !hasLines;
  holdBtn.disabled = !hasLines;
  voidBtn.disabled = false;
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

  const total = tabTotal(tab);
  document.getElementById('payAmountValue').textContent = '$' + total.toFixed(2);
  selectedPayMethod = 'card';
  selectedTip = 0;
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
  const sub = tabSubtotal(tab);
  const tax = tabTax(tab);
  const tip = sub * selectedTip;
  const grand = sub + tax + tip;
  document.getElementById('payAmountValue').textContent = '$' + grand.toFixed(2);
}

function submitPayment() {
  const tab = getActiveTab();
  if (!tab) return;

  tab.status = 'paid';
  tab.paidAt = new Date();
  tab.payMethod = selectedPayMethod;
  tab.tipPct = selectedTip;
  tab.tipAmount = tabSubtotal(tab) * selectedTip;

  // Move to closed
  tab.status = 'closed';

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
// NEW TAB MODAL
// ═══════════════════════════════════════════

function openNewTabModal() {
  document.getElementById('newTabName').value = '';
  openModal('newTabModal');
  setTimeout(() => document.getElementById('newTabName').focus(), 100);
}

function createNamedTab() {
  const name = document.getElementById('newTabName').value.trim();
  createTab(name || 'Tab ' + nextTabNum);
}

function createQuickTab(type) {
  if (type === 'bar') {
    createTab('Bar ' + nextTabNum, 'bar');
  } else if (type === 'walkin') {
    createTab('Walk-in ' + nextTabNum, 'bar');
  } else if (type === 'member') {
    // TODO: member lookup
    createTab('Member', 'member');
  } else if (type === 'table') {
    // TODO: table selection
    createTab('Table', 'table');
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
});

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  showScreen('login');
  initLogin();
});
