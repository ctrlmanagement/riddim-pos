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
