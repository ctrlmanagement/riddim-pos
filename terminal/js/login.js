/* RIDDIM POS — Login / Logout */
'use strict';

// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════

let pinBuffer = '';
let failedAttempts = 0;
let lockoutUntil = 0;
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60_000; // 1 minute

function initLogin() {
  pinBuffer = '';
  updatePinDots();
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginStation').textContent = TERMINAL_NAME || STATION.label;
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
  // PIN lockout check
  if (Date.now() < lockoutUntil) {
    const secs = Math.ceil((lockoutUntil - Date.now()) / 1000);
    document.getElementById('loginError').textContent = `Too many attempts — locked for ${secs}s`;
    pinBuffer = '';
    updatePinDots();
    return;
  }

  const user = STAFF.find(s => s.pin === pinBuffer);
  if (user) {
    failedAttempts = 0;
    // Load permissions from security group
    if (user.securityGroupId) {
      user.permissions = await loadPermissions(user.securityGroupId);
    } else {
      user.permissions = new Set();
    }
    currentUser = user;
    document.getElementById('loginError').textContent = '';
    if (typeof stopScreensaverTimer === 'function') stopScreensaverTimer();
    startIdleTimer();
    enterTerminal();
  } else {
    failedAttempts++;
    if (failedAttempts >= MAX_PIN_ATTEMPTS) {
      lockoutUntil = Date.now() + LOCKOUT_DURATION;
      document.getElementById('loginError').textContent = `Too many attempts — locked for 60s`;
      if (typeof serverAuditLog === 'function') {
        serverAuditLog('pin_lockout', { attempts: failedAttempts, station: STATION.code });
      }
    } else {
      document.getElementById('loginError').textContent = STAFF.length === 0
        ? 'No staff configured — add POS PINs in Owner portal'
        : `Invalid PIN (${MAX_PIN_ATTEMPTS - failedAttempts} attempts left)`;
    }
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
    // Wait briefly for server connection to establish
    if (!serverConnected && SERVER_URL) {
      await new Promise(r => setTimeout(r, 500));
    }
    // Load today's orders from local server (survives terminal restart)
    if (typeof hydrateTabsFromServer === 'function') {
      const loaded = await hydrateTabsFromServer();
      if (loaded > 0) {
        console.log('Hydrated', loaded, 'tabs from server');
        // Re-fetch booking data (deposits, min spend) for hydrated tabs
        for (const tab of tabs) {
          if (tab.bookingId && !tab.depositAmount && typeof applyBookingToTab === 'function') {
            await applyBookingToTab(tab, tab.bookingId);
          }
        }
        renderTabs();
        renderCart();
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

  // Edit check button (comp/discount/service charge)
  const editBtn = document.getElementById('btnEditCheck');
  if (editBtn) editBtn.style.display = (hasPermission('order.comp') || hasPermission('order.discount') || hasPermission('tab.auto_service_charge') || hasPermission('tab.edit_name')) ? '' : 'none';

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
    'reports': ['mgmt.view_sales', 'mgmt.view_employee_reports', 'mgmt.view_dsr'],
    'servers': 'mgmt.view_servers',
    'clock': 'clock.view_others',
    'checks': 'pay.change_tip',
    'settings': 'mgmt.edit_config',
    'dayclose': 'mgmt.close_day',
    'staff-manage': 'mgmt.manage_staff',
  };
  Object.entries(mgmtSections).forEach(([section, perm]) => {
    const btn = document.querySelector(`.mgmt-nav-btn[data-mgmt="${section}"]`);
    if (!btn) return;
    const allowed = Array.isArray(perm) ? perm.some(p => hasPermission(p)) : hasPermission(perm);
    btn.style.display = allowed ? '' : 'none';
  });

  // Report tab gating — each tab requires a specific permission tier
  const reportTabPerms = {
    'summary': 'mgmt.view_sales',
    'product': 'mgmt.view_sales',
    'hourly': 'mgmt.view_sales',
    'station': 'mgmt.view_sales',
    'employee': 'mgmt.view_employee_reports',
    'checkout': 'mgmt.view_employee_reports',
    'dsr': 'mgmt.view_dsr',
    'paidouts': 'mgmt.view_dsr',
    'custom': 'mgmt.view_dsr',
  };
  let firstVisible = null;
  document.querySelectorAll('.rpt-tab').forEach(tab => {
    const rpt = tab.getAttribute('data-rpt');
    const perm = reportTabPerms[rpt];
    const show = perm ? hasPermission(perm) : true;
    tab.style.display = show ? '' : 'none';
    if (show && !firstVisible) firstVisible = rpt;
  });
  // Reset active tab to first visible
  if (firstVisible) {
    document.querySelectorAll('.rpt-tab').forEach(t => t.classList.remove('active'));
    const first = document.querySelector(`.rpt-tab[data-rpt="${firstVisible}"]`);
    if (first) first.classList.add('active');
  }
}

async function shutdownTerminal() {
  if (!await posConfirm('Shut down this terminal? It will need to be physically powered back on.')) return;
  try {
    await serverPost('/api/terminal/shutdown', { terminal: TERMINAL_NAME });
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0A0A0A;color:#888;font-family:DM Sans,sans-serif;font-size:18px;">Shutting down...</div>';
  } catch (e) {
    showToast('Shutdown failed');
  }
}

function logout() {
  stopIdleTimer();
  // Clean up Act As state
  if (actingAs) {
    actingAs = null;
    realUser = null;
    const banner = document.getElementById('actAsBanner');
    if (banner) banner.remove();
  }
  currentUser = null;
  showScreen('login');
  initLogin();
  if (typeof startScreensaverTimer === 'function') startScreensaverTimer();
}

// ═══════════════════════════════════════════
// IDLE AUTO-LOGOUT (non-owner roles)
// ═══════════════════════════════════════════

const IDLE_TIMEOUT_MS = 90_000; // 90 seconds
let _idleTimer = null;

function startIdleTimer() {
  stopIdleTimer();
  if (!currentUser) return;
  // Owner/GM don't auto-logout
  if (getRoleLevel(currentUser) >= 4) return;
  _idleTimer = setTimeout(() => {
    if (currentUser && getRoleLevel(currentUser) < 4) {
      showToast(currentUser.name + ' auto-logged out (idle)', 'warning');
      logout();
    }
  }, IDLE_TIMEOUT_MS);
}

function stopIdleTimer() {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
}

function resetIdleTimer() {
  if (currentUser) startIdleTimer();
}

// Reset on any touch/mouse/key activity
['touchstart', 'mousedown', 'keydown'].forEach(evt => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});

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
