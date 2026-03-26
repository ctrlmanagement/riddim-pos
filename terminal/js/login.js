/* RIDDIM POS — Login / Logout */
'use strict';

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

async function attemptLogin() {
  const user = STAFF.find(s => s.pin === pinBuffer);
  if (user) {
    // Load permissions from security group
    if (user.securityGroupId) {
      user.permissions = await loadPermissions(user.securityGroupId);
    } else {
      user.permissions = new Set();
    }
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

async function enterTerminal() {
  showScreen('main');
  document.getElementById('topBarUser').textContent = currentUser.name;
  document.getElementById('topBarStation').textContent = STATION.label;
  updateManagementAccess();
  applyPermissionUI();

  // Connect to local server + hydrate tabs from PG
  if (typeof initServerLink === 'function') {
    await initServerLink();
    // Load today's orders from local server (survives terminal restart)
    if (typeof hydrateTabsFromServer === 'function') {
      const loaded = await hydrateTabsFromServer();
      if (loaded > 0) {
        console.log('Hydrated', loaded, 'tabs from server');
        // Re-fetch booking data (deposits, min spend) for hydrated table tabs
        for (const tab of tabs) {
          if (tab.tableNum && !tab.depositAmount) {
            const session = tableSessions ? tableSessions[tab.tableNum] : null;
            if (session && session.booking_id && typeof applyBookingToTab === 'function') {
              await applyBookingToTab(tab, session.booking_id);
            }
          }
        }
      }
    }
  }

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

// Hide/show UI elements based on permissions
function applyPermissionUI() {
  // Void button
  const voidBtn = document.getElementById('btnVoid');
  if (voidBtn) voidBtn.style.display = hasPermission('order.void_tab') ? '' : 'none';

  // Edit check button (comp/discount/gratuity)
  const editBtn = document.getElementById('btnEditCheck');
  if (editBtn) editBtn.style.display = (hasPermission('order.comp') || hasPermission('order.discount') || hasPermission('tab.set_gratuity') || hasPermission('tab.edit_name')) ? '' : 'none';

  // 86 badge/button
  const eightySixBtn = document.getElementById('btn86');
  if (eightySixBtn) eightySixBtn.style.display = hasPermission('floor.86_toggle') ? '' : 'none';

  // Pay button
  const payBtn = document.getElementById('btnPay');
  if (payBtn) payBtn.style.display = hasPermission('tab.close') ? '' : 'none';

  // Tables nav
  const navTables = document.getElementById('navTables');
  if (navTables) navTables.style.display = hasPermission('floor.view_all_tables') ? '' : 'none';

  // Management sub-sections gating
  const mgmtSections = {
    'menu': 'mgmt.edit_menu',
    'categories': 'mgmt.edit_menu',
    'staff': 'mgmt.edit_config',
    'stations': 'mgmt.edit_config',
    'reports': 'mgmt.view_sales',
    'servers': 'mgmt.view_servers',
    'clock': 'clock.view_others',
    'checks': 'pay.change_tip',
    'settings': 'mgmt.edit_config',
    'dayclose': 'mgmt.close_day',
  };
  Object.entries(mgmtSections).forEach(([section, perm]) => {
    const btn = document.querySelector(`.mgmt-nav-btn[data-mgmt="${section}"]`);
    if (btn) btn.style.display = hasPermission(perm) ? '' : 'none';
  });
}

function logout() {
  currentUser = null;
  showScreen('login');
  initLogin();
}

// ═══════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════

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
