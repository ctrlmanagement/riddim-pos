/* RIDDIM POS — Management Module
   Owner/Manager functions: menu, staff, categories, stations, settings, close day
   S75: Initial build */

'use strict';

// ═══════════════════════════════════════════
// VIEW SWITCHING (Terminal <-> Management)
// ═══════════════════════════════════════════

function switchView(view) {
  const terminalBody = document.querySelector('.main-body');
  const tablesPanel = document.getElementById('tablesPanel');
  const mgmtPanel = document.getElementById('managementPanel');
  const navTables = document.getElementById('navTables');
  const navTerminal = document.getElementById('navTerminal');
  const navManagement = document.getElementById('navManagement');

  // Hide all
  terminalBody.style.display = 'none';
  tablesPanel.classList.remove('active');
  mgmtPanel.style.display = 'none';
  navTables.classList.remove('active');
  navTerminal.classList.remove('active');
  navManagement.classList.remove('active');

  if (view === 'tables') {
    tablesPanel.classList.add('active');
    navTables.classList.add('active');
    updateFloorPlan();
  } else if (view === 'management') {
    mgmtPanel.style.display = 'flex';
    navManagement.classList.add('active');
    renderMgmtMenu();
  } else {
    terminalBody.style.display = 'flex';
    navTerminal.classList.add('active');
  }
}

function switchMgmt(section) {
  document.querySelectorAll('.mgmt-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.mgmt-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mgmt-' + section).classList.add('active');
  document.querySelector(`.mgmt-nav-btn[data-mgmt="${section}"]`).classList.add('active');

  // Render the section
  if (section === 'menu') renderMgmtMenu();
  if (section === 'categories') renderMgmtCategories();
  if (section === 'staff') renderMgmtStaff();
  if (section === 'stations') renderMgmtStations();
  if (section === 'reports') renderReport('summary');
  if (section === 'servers') renderMgmtServers();
  if (section === 'clock') renderMgmtClock();
  if (section === 'checks') renderMgmtChecks();
  if (section === 'settings') renderMgmtSettings();
  if (section === 'dayclose') renderMgmtDayClose();
}

// Show management nav for owner/manager roles
function updateManagementAccess() {
  const navBtn = document.getElementById('navManagement');
  if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'manager')) {
    navBtn.style.display = '';
  } else {
    navBtn.style.display = 'none';
  }
}

// ═══════════════════════════════════════════
// MENU ITEMS MANAGEMENT
// ═══════════════════════════════════════════

function renderMgmtMenu() {
  // Populate filter dropdown
  const filter = document.getElementById('mgmtMenuFilter');
  const currentVal = filter.value;
  filter.innerHTML = '<option value="all">All Categories</option>' +
    MENU_CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  filter.value = currentVal || 'all';

  // Filter + search
  const search = (document.getElementById('mgmtMenuSearch')?.value || '').toLowerCase();
  let items = [...MENU_ITEMS];
  if (filter.value !== 'all') items = items.filter(i => i.cat === filter.value);
  if (search) items = items.filter(i => i.name.toLowerCase().includes(search));

  // Get category names
  const catMap = {};
  MENU_CATEGORIES.forEach(c => catMap[c.id] = c.name);

  const list = document.getElementById('mgmtMenuList');
  if (items.length === 0) {
    list.innerHTML = '<div class="mgmt-empty">No items found</div>';
    return;
  }

  list.innerHTML = `
    <table class="mgmt-table">
      <thead>
        <tr><th>NAME</th><th>PRICE</th><th>CATEGORY</th><th>RAIL</th><th>SORT</th><th></th></tr>
      </thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td>${i.name}</td>
            <td>$${i.price.toFixed(2)}</td>
            <td>${catMap[i.cat] || '—'}</td>
            <td>${i.speedRail ? 'YES' : ''}</td>
            <td>${i.sortOrder || 0}</td>
            <td><button class="mgmt-edit-btn" onclick="openEditItemModal('${i.id}')">EDIT</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openAddItemModal() {
  document.getElementById('editItemTitle').textContent = 'ADD ITEM';
  document.getElementById('editItemId').value = '';
  document.getElementById('editItemName').value = '';
  document.getElementById('editItemPrice').value = '';
  document.getElementById('editItemSpeedRail').checked = false;
  document.getElementById('editItemSort').value = '0';
  document.getElementById('editItemDeleteBtn').style.display = 'none';

  // Populate category dropdown
  const sel = document.getElementById('editItemCategory');
  sel.innerHTML = MENU_CATEGORIES.map(c =>
    `<option value="${c.id}">${c.name}</option>`
  ).join('');

  openModal('editItemModal');
}

function openEditItemModal(itemId) {
  const item = MENU_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('editItemTitle').textContent = 'EDIT ITEM';
  document.getElementById('editItemId').value = item.id;
  document.getElementById('editItemName').value = item.name;
  document.getElementById('editItemPrice').value = item.price;
  document.getElementById('editItemSpeedRail').checked = item.speedRail;
  document.getElementById('editItemSort').value = item.sortOrder || 0;
  document.getElementById('editItemDeleteBtn').style.display = '';

  const sel = document.getElementById('editItemCategory');
  sel.innerHTML = MENU_CATEGORIES.map(c =>
    `<option value="${c.id}" ${c.id === item.cat ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  openModal('editItemModal');
}

async function saveMenuItem() {
  const id = document.getElementById('editItemId').value;
  const name = document.getElementById('editItemName').value.trim();
  const price = parseFloat(document.getElementById('editItemPrice').value);
  const categoryId = document.getElementById('editItemCategory').value;
  const speedRail = document.getElementById('editItemSpeedRail').checked;
  const sortOrder = parseInt(document.getElementById('editItemSort').value) || 0;

  if (!name || isNaN(price) || price < 0) {
    showToast('Name and valid price required');
    return;
  }

  const row = {
    name,
    price,
    category_id: categoryId,
    speed_rail: speedRail,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (id) {
    // Update
    ({ error } = await sb.from('pos_menu_items').update(row).eq('id', id));
  } else {
    // Insert
    row.active = true;
    ({ error } = await sb.from('pos_menu_items').insert(row));
  }

  if (error) {
    showToast('Save failed: ' + error.message);
    return;
  }

  closeModal('editItemModal');
  await loadMenuItems();
  renderMgmtMenu();
  showToast(id ? 'Item updated' : 'Item added');
}

async function deleteMenuItem() {
  const id = document.getElementById('editItemId').value;
  if (!id) return;

  // Soft delete — set active = false
  const { error } = await sb.from('pos_menu_items').update({ active: false }).eq('id', id);
  if (error) {
    showToast('Delete failed: ' + error.message);
    return;
  }

  closeModal('editItemModal');
  await loadMenuItems();
  renderMgmtMenu();
  showToast('Item removed');
}

// ═══════════════════════════════════════════
// CATEGORIES MANAGEMENT
// ═══════════════════════════════════════════

function renderMgmtCategories() {
  const list = document.getElementById('mgmtCategoryList');
  list.innerHTML = `
    <table class="mgmt-table">
      <thead>
        <tr><th>NAME</th><th>COLOR</th><th>SORT</th><th>ITEMS</th><th></th></tr>
      </thead>
      <tbody>
        ${MENU_CATEGORIES.map(c => {
          const count = MENU_ITEMS.filter(i => i.cat === c.id).length;
          return `
          <tr>
            <td>${c.name}</td>
            <td>${c.color ? `<span style="color:${c.color}">${c.color}</span>` : '—'}</td>
            <td>${c.sortOrder || 0}</td>
            <td>${count}</td>
            <td><button class="mgmt-edit-btn" onclick="openEditCategoryModal('${c.id}')">EDIT</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function openAddCategoryModal() {
  document.getElementById('editCatTitle').textContent = 'ADD CATEGORY';
  document.getElementById('editCatId').value = '';
  document.getElementById('editCatName').value = '';
  document.getElementById('editCatColor').value = '';
  document.getElementById('editCatSort').value = '0';
  openModal('editCategoryModal');
}

function openEditCategoryModal(catId) {
  const cat = MENU_CATEGORIES.find(c => c.id === catId);
  if (!cat) return;
  document.getElementById('editCatTitle').textContent = 'EDIT CATEGORY';
  document.getElementById('editCatId').value = cat.id;
  document.getElementById('editCatName').value = cat.name;
  document.getElementById('editCatColor').value = cat.color || '';
  document.getElementById('editCatSort').value = cat.sortOrder || 0;
  openModal('editCategoryModal');
}

async function saveCategory() {
  const id = document.getElementById('editCatId').value;
  const name = document.getElementById('editCatName').value.trim().toUpperCase();
  const color = document.getElementById('editCatColor').value.trim() || null;
  const sortOrder = parseInt(document.getElementById('editCatSort').value) || 0;

  if (!name) { showToast('Name required'); return; }

  const row = { name, color, sort_order: sortOrder };
  let error;
  if (id) {
    ({ error } = await sb.from('pos_menu_categories').update(row).eq('id', id));
  } else {
    row.active = true;
    ({ error } = await sb.from('pos_menu_categories').insert(row));
  }

  if (error) { showToast('Save failed: ' + error.message); return; }

  closeModal('editCategoryModal');
  await loadCategories();
  await loadMenuItems(); // refresh category mappings
  renderMgmtCategories();
  showToast(id ? 'Category updated' : 'Category added');
}

// ═══════════════════════════════════════════
// STAFF / PINS MANAGEMENT
// ═══════════════════════════════════════════

let allStaffForMgmt = [];

async function renderMgmtStaff() {
  // Load ALL staff (not just POS-enabled)
  const { data, error } = await sb
    .from('staff')
    .select('id, first_name, last_name, phone, role, pos_pin, pos_role, active')
    .eq('active', true)
    .order('first_name');

  if (error) { showToast('Failed to load staff'); return; }
  allStaffForMgmt = data || [];

  const list = document.getElementById('mgmtStaffList');
  list.innerHTML = `
    <table class="mgmt-table">
      <thead>
        <tr><th>NAME</th><th>ROLE</th><th>POS PIN</th><th>POS ROLE</th><th></th></tr>
      </thead>
      <tbody>
        ${allStaffForMgmt.map(s => `
          <tr>
            <td>${s.first_name} ${s.last_name || ''}</td>
            <td>${s.role || '—'}</td>
            <td>${s.pos_pin || '<span style="color:var(--ash)">none</span>'}</td>
            <td>${s.pos_role || '<span style="color:var(--ash)">no access</span>'}</td>
            <td><button class="mgmt-edit-btn" onclick="openEditStaffModal('${s.id}')">EDIT</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openEditStaffModal(staffId) {
  const s = allStaffForMgmt.find(x => x.id === staffId);
  if (!s) return;
  document.getElementById('editStaffId').value = s.id;
  document.getElementById('editStaffName').textContent = s.first_name + ' ' + (s.last_name || '');
  document.getElementById('editStaffPin').value = s.pos_pin || '';
  document.getElementById('editStaffRole').value = s.pos_role || '';
  openModal('editStaffModal');
}

async function saveStaffPin() {
  const id = document.getElementById('editStaffId').value;
  const pin = document.getElementById('editStaffPin').value.trim();
  const role = document.getElementById('editStaffRole').value;

  if (pin && !/^\d{4}$/.test(pin)) {
    showToast('PIN must be exactly 4 digits');
    return;
  }

  // Check for duplicate PINs
  if (pin) {
    const { data: existing } = await sb
      .from('staff')
      .select('id, first_name')
      .eq('pos_pin', pin)
      .eq('active', true)
      .neq('id', id);
    if (existing && existing.length > 0) {
      showToast('PIN already used by ' + existing[0].first_name);
      return;
    }
  }

  const { error } = await sb.from('staff').update({
    pos_pin: pin || null,
    pos_role: role || null,
  }).eq('id', id);

  if (error) { showToast('Save failed: ' + error.message); return; }

  closeModal('editStaffModal');
  await loadStaff(); // refresh terminal staff list
  await renderMgmtStaff();
  showToast('Staff updated');
}

// ═══════════════════════════════════════════
// STATIONS MANAGEMENT
// ═══════════════════════════════════════════

async function renderMgmtStations() {
  const { data, error } = await sb
    .from('pos_stations')
    .select('*')
    .order('code');

  if (error) { showToast('Failed to load stations'); return; }

  const list = document.getElementById('mgmtStationList');
  list.innerHTML = `
    <table class="mgmt-table">
      <thead>
        <tr><th>CODE</th><th>LABEL</th><th>POS NAME</th><th>ACTIVE</th><th></th></tr>
      </thead>
      <tbody>
        ${(data || []).map(s => `
          <tr>
            <td>${s.code}</td>
            <td>${s.label}</td>
            <td>${s.pos_name || '—'}</td>
            <td>${s.active ? '<span style="color:var(--green)">YES</span>' : '<span style="color:var(--ash)">NO</span>'}</td>
            <td><button class="mgmt-edit-btn" onclick="toggleStation('${s.id}', ${!s.active})">${s.active ? 'DISABLE' : 'ENABLE'}</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function toggleStation(stationId, active) {
  const { error } = await sb.from('pos_stations').update({ active }).eq('id', stationId);
  if (error) { showToast('Failed: ' + error.message); return; }
  await loadStations();
  renderMgmtStations();
  showToast(active ? 'Station enabled' : 'Station disabled');
}

// ═══════════════════════════════════════════
// POS SETTINGS
// ═══════════════════════════════════════════

async function renderMgmtSettings() {
  const { data, error } = await sb.from('pos_config').select('*').limit(1).single();
  if (error || !data) { showToast('Failed to load settings'); return; }

  const el = document.getElementById('mgmtSettings');
  el.innerHTML = `
    <div class="form-row">
      <label class="form-label">TAX RATE (%)</label>
      <input type="number" id="settingTaxRate" class="form-input" step="0.001" value="${(data.tax_rate * 100).toFixed(1)}">
    </div>
    <div class="form-row">
      <label class="form-label">DEFAULT TIP (%)</label>
      <input type="number" id="settingTipPct" class="form-input" step="1" value="${(data.default_tip_pct * 100).toFixed(0)}">
    </div>
    <div class="form-row">
      <label class="form-label">MAX DISCOUNT (%)</label>
      <input type="number" id="settingMaxDiscount" class="form-input" step="1" value="${(data.max_discount_pct * 100).toFixed(0)}">
    </div>
    <div class="form-row">
      <label class="form-label">REQUIRE MANAGER FOR VOID</label>
      <label class="form-toggle"><input type="checkbox" id="settingMgrVoid" ${data.require_manager_void ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="form-row">
      <label class="form-label">REQUIRE MANAGER FOR COMP</label>
      <label class="form-toggle"><input type="checkbox" id="settingMgrComp" ${data.require_manager_comp ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="form-row">
      <label class="form-label">REQUIRE MANAGER FOR DISCOUNT</label>
      <label class="form-toggle"><input type="checkbox" id="settingMgrDiscount" ${data.require_manager_discount ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="form-row">
      <label class="form-label">RECEIPT FOOTER</label>
      <input type="text" id="settingReceipt" class="form-input" value="${data.receipt_footer || ''}">
    </div>
    <div class="form-actions">
      <button class="mgmt-action-btn" onclick="saveSettings()">SAVE SETTINGS</button>
    </div>
  `;
}

async function saveSettings() {
  const row = {
    tax_rate: parseFloat(document.getElementById('settingTaxRate').value) / 100,
    default_tip_pct: parseFloat(document.getElementById('settingTipPct').value) / 100,
    max_discount_pct: parseFloat(document.getElementById('settingMaxDiscount').value) / 100,
    require_manager_void: document.getElementById('settingMgrVoid').checked,
    require_manager_comp: document.getElementById('settingMgrComp').checked,
    require_manager_discount: document.getElementById('settingMgrDiscount').checked,
    receipt_footer: document.getElementById('settingReceipt').value.trim(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from('pos_config').update(row).not('id', 'is', null);
  if (error) { showToast('Save failed: ' + error.message); return; }

  await loadConfig();
  showToast('Settings saved');
}

// ═══════════════════════════════════════════
// CLOSE DAY
// ═══════════════════════════════════════════

function renderMgmtDayClose() {
  const closedTabs = tabs.filter(t => t.status === 'closed');
  const voidedTabs = tabs.filter(t => t.status === 'voided');
  const openTabs = tabs.filter(t => t.status === 'open' || t.status === 'sent');

  let totalSales = 0, totalTips = 0, cardSales = 0, cashSales = 0, compSales = 0;
  closedTabs.forEach(t => {
    const sub = tabSubtotal(t);
    const tax = tabTax(t);
    totalSales += sub + tax;
    totalTips += t.tipAmount || 0;
    if (t.payMethod === 'card') cardSales += sub + tax;
    if (t.payMethod === 'cash') cashSales += sub + tax;
    if (t.payMethod === 'comp') compSales += sub + tax;
  });

  const el = document.getElementById('mgmtDayClose');
  el.innerHTML = `
    <div class="dayclose-summary">
      <div class="dayclose-row">
        <span>OPEN TABS</span>
        <span class="${openTabs.length > 0 ? 'text-red' : ''}">${openTabs.length}</span>
      </div>
      <div class="dayclose-row">
        <span>CLOSED TABS</span>
        <span>${closedTabs.length}</span>
      </div>
      <div class="dayclose-row">
        <span>VOIDED TABS</span>
        <span>${voidedTabs.length}</span>
      </div>
      <div class="dayclose-divider"></div>
      <div class="dayclose-row">
        <span>CARD SALES</span>
        <span>$${cardSales.toFixed(2)}</span>
      </div>
      <div class="dayclose-row">
        <span>CASH SALES</span>
        <span>$${cashSales.toFixed(2)}</span>
      </div>
      <div class="dayclose-row">
        <span>COMP</span>
        <span>$${compSales.toFixed(2)}</span>
      </div>
      <div class="dayclose-divider"></div>
      <div class="dayclose-row grand">
        <span>TOTAL SALES</span>
        <span>$${totalSales.toFixed(2)}</span>
      </div>
      <div class="dayclose-row">
        <span>TOTAL TIPS</span>
        <span>$${totalTips.toFixed(2)}</span>
      </div>
      <div class="dayclose-row grand">
        <span>GRAND TOTAL</span>
        <span>$${(totalSales + totalTips).toFixed(2)}</span>
      </div>
    </div>
    ${openTabs.length > 0 ? '<div class="dayclose-warning">Close all open tabs before closing the day</div>' : `
      <div class="form-actions" style="margin-top:20px">
        <button class="mgmt-action-btn" onclick="closeDay()">CLOSE DAY</button>
      </div>
    `}
  `;
}

async function closeDay() {
  // Phase 2: This will write to daily_payouts / P&L tables
  showToast('Day closed — summary saved');
  // Reset terminal state
  tabs = [];
  activeTabId = null;
  nextTabNum = 1;
  switchView('terminal');
  renderTabs();
  renderCart();
}

// ═══════════════════════════════════════════
// FOH REPORTS
// ═══════════════════════════════════════════

function switchReport(type) {
  document.querySelectorAll('.rpt-tab').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.rpt-tab[data-rpt="${type}"]`);
  if (btn) btn.classList.add('active');
  renderReport(type);
}

function getClosedTabs() {
  return tabs.filter(t => t.status === 'closed' || t.status === 'paid');
}

function renderReport(type) {
  const el = document.getElementById('rptContent');
  if (!el) return;

  if (type === 'summary') renderReportSummary(el);
  else if (type === 'product') renderReportProduct(el);
  else if (type === 'employee') renderReportEmployee(el);
  else if (type === 'hourly') renderReportHourly(el);
  else if (type === 'station') renderReportStation(el);
}

function renderReportSummary(el) {
  const closed = getClosedTabs();
  const voided = tabs.filter(t => t.status === 'voided');
  const open = tabs.filter(t => t.status === 'open' || t.status === 'sent');

  let gross = 0, discounts = 0, comps = 0, tax = 0, tips = 0;
  let cardCount = 0, cashCount = 0, compCount = 0;

  closed.forEach(t => {
    const sub = tabSubtotal(t);
    const disc = tabDiscountAmount(t);
    const compAmt = t.lines.filter(l => l.comped).reduce((s, l) => s + l.price * l.qty, 0);
    gross += sub;
    discounts += disc;
    comps += compAmt;
    tax += tabTax(t);
    tips += t.tipAmount || 0;
    if (t.payMethod === 'card') cardCount++;
    else if (t.payMethod === 'cash') cashCount++;
    else if (t.payMethod === 'comp') compCount++;
  });

  const net = gross - discounts - comps;
  const avgCheck = closed.length > 0 ? (net + tax) / closed.length : 0;

  el.innerHTML = `
    <div class="rpt-grid">
      <div class="rpt-card">
        <div class="rpt-card-val">$${gross.toFixed(2)}</div>
        <div class="rpt-card-lbl">GROSS SALES</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${net.toFixed(2)}</div>
        <div class="rpt-card-lbl">NET SALES</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${tax.toFixed(2)}</div>
        <div class="rpt-card-lbl">TAX</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${tips.toFixed(2)}</div>
        <div class="rpt-card-lbl">TIPS</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">${closed.length}</div>
        <div class="rpt-card-lbl">CHECKS CLOSED</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${avgCheck.toFixed(2)}</div>
        <div class="rpt-card-lbl">AVG CHECK</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${discounts.toFixed(2)}</div>
        <div class="rpt-card-lbl">DISCOUNTS</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${comps.toFixed(2)}</div>
        <div class="rpt-card-lbl">COMPS</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">${voided.length}</div>
        <div class="rpt-card-lbl">VOIDED</div>
      </div>
    </div>
    <div class="rpt-section">
      <div class="rpt-row"><span>CARD</span><span>${cardCount} checks</span></div>
      <div class="rpt-row"><span>CASH</span><span>${cashCount} checks</span></div>
      <div class="rpt-row"><span>COMP</span><span>${compCount} checks</span></div>
      <div class="rpt-row"><span>OPEN</span><span class="${open.length ? 'text-red' : ''}">${open.length} tabs</span></div>
    </div>
  `;
}

function renderReportProduct(el) {
  const closed = getClosedTabs();
  const itemTotals = {};

  closed.forEach(t => {
    t.lines.forEach(l => {
      if (l.voided) return;
      const key = l.menuItemId || l.name;
      if (!itemTotals[key]) {
        itemTotals[key] = { name: l.name, qty: 0, revenue: 0 };
      }
      itemTotals[key].qty += l.qty;
      if (!l.comped) itemTotals[key].revenue += l.price * l.qty;
    });
  });

  const items = Object.values(itemTotals).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);

  if (items.length === 0) {
    el.innerHTML = '<div class="mgmt-empty">No sales data</div>';
    return;
  }

  el.innerHTML = `
    <table class="mgmt-table">
      <thead><tr><th>ITEM</th><th>QTY</th><th>REVENUE</th><th>% MIX</th></tr></thead>
      <tbody>
        ${items.map(i => `<tr>
          <td>${i.name}</td>
          <td>${i.qty}</td>
          <td>$${i.revenue.toFixed(2)}</td>
          <td>${totalRevenue > 0 ? ((i.revenue / totalRevenue) * 100).toFixed(1) + '%' : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function renderReportEmployee(el) {
  const closed = getClosedTabs();
  const staffTotals = {};

  // Build staff name map
  const staffMap = {};
  STAFF.forEach(s => staffMap[s.id] = s.name);

  closed.forEach(t => {
    const staffId = t.createdBy;
    const name = staffMap[staffId] || 'Unknown';
    if (!staffTotals[staffId]) {
      staffTotals[staffId] = { name, tabs: 0, sales: 0, tips: 0, items: 0 };
    }
    staffTotals[staffId].tabs++;
    staffTotals[staffId].sales += tabSubtotal(t) - tabDiscountAmount(t) + tabTax(t);
    staffTotals[staffId].tips += t.tipAmount || 0;
    staffTotals[staffId].items += t.lines.filter(l => !l.voided).reduce((s, l) => s + l.qty, 0);
  });

  const employees = Object.values(staffTotals).sort((a, b) => b.sales - a.sales);

  if (employees.length === 0) {
    el.innerHTML = '<div class="mgmt-empty">No sales data</div>';
    return;
  }

  el.innerHTML = `
    <table class="mgmt-table">
      <thead><tr><th>SERVER</th><th>TABS</th><th>ITEMS</th><th>SALES</th><th>TIPS</th></tr></thead>
      <tbody>
        ${employees.map(e => `<tr>
          <td>${e.name}</td>
          <td>${e.tabs}</td>
          <td>${e.items}</td>
          <td>$${e.sales.toFixed(2)}</td>
          <td>$${e.tips.toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function renderReportHourly(el) {
  const closed = getClosedTabs();
  const hourly = {};

  closed.forEach(t => {
    const hour = new Date(t.createdAt).getHours();
    if (!hourly[hour]) hourly[hour] = { tabs: 0, sales: 0, items: 0 };
    hourly[hour].tabs++;
    hourly[hour].sales += tabSubtotal(t) - tabDiscountAmount(t) + tabTax(t);
    hourly[hour].items += t.lines.filter(l => !l.voided).reduce((s, l) => s + l.qty, 0);
  });

  const hours = Object.keys(hourly).map(Number).sort((a, b) => a - b);

  if (hours.length === 0) {
    el.innerHTML = '<div class="mgmt-empty">No sales data</div>';
    return;
  }

  el.innerHTML = `
    <table class="mgmt-table">
      <thead><tr><th>HOUR</th><th>TABS</th><th>ITEMS</th><th>SALES</th></tr></thead>
      <tbody>
        ${hours.map(h => {
          const d = hourly[h];
          const label = ((h % 12) || 12) + (h < 12 ? ' AM' : ' PM');
          return `<tr>
            <td>${label}</td>
            <td>${d.tabs}</td>
            <td>${d.items}</td>
            <td>$${d.sales.toFixed(2)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderReportStation(el) {
  const closed = getClosedTabs();
  const stationTotals = {};

  closed.forEach(t => {
    const st = t.station || 'Unknown';
    if (!stationTotals[st]) stationTotals[st] = { tabs: 0, sales: 0, items: 0 };
    stationTotals[st].tabs++;
    stationTotals[st].sales += tabSubtotal(t) - tabDiscountAmount(t) + tabTax(t);
    stationTotals[st].items += t.lines.filter(l => !l.voided).reduce((s, l) => s + l.qty, 0);
  });

  const stations = Object.entries(stationTotals).sort((a, b) => b[1].sales - a[1].sales);

  if (stations.length === 0) {
    el.innerHTML = '<div class="mgmt-empty">No sales data</div>';
    return;
  }

  // Map station codes to labels
  const stLabel = {};
  STATIONS.forEach(s => stLabel[s.code] = s.label);

  el.innerHTML = `
    <table class="mgmt-table">
      <thead><tr><th>STATION</th><th>TABS</th><th>ITEMS</th><th>SALES</th></tr></thead>
      <tbody>
        ${stations.map(([code, d]) => `<tr>
          <td>${stLabel[code] || code}</td>
          <td>${d.tabs}</td>
          <td>${d.items}</td>
          <td>$${d.sales.toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

// ═══════════════════════════════════════════
// VIEW SERVERS — all open tabs by server
// ═══════════════════════════════════════════

function renderMgmtServers() {
  const staffMap = {};
  STAFF.forEach(s => staffMap[s.id] = s.name);

  // Group open tabs by creator
  const serverTabs = {};
  tabs.filter(t => t.status === 'open' || t.status === 'sent').forEach(t => {
    const id = t.createdBy;
    const name = staffMap[id] || 'Unknown';
    if (!serverTabs[id]) serverTabs[id] = { name, tabs: [] };
    serverTabs[id].tabs.push(t);
  });

  const list = document.getElementById('mgmtServersList');
  const servers = Object.values(serverTabs);

  if (servers.length === 0) {
    list.innerHTML = '<div class="mgmt-empty">No open tabs</div>';
    return;
  }

  list.innerHTML = servers.map(s => {
    const totalSales = s.tabs.reduce((sum, t) => sum + tabTotal(t), 0);
    return `
      <div class="server-card">
        <div class="server-card-header">
          <span class="server-card-name">${s.name}</span>
          <span class="server-card-stat">${s.tabs.length} tabs — $${totalSales.toFixed(2)}</span>
        </div>
        <div class="server-card-tabs">
          ${s.tabs.map(t => `
            <div class="server-tab-row" onclick="mgmtSelectTab('${t.id}')">
              <span>${t.name}</span>
              <span>$${tabTotal(t).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function mgmtSelectTab(tabId) {
  activeTabId = tabId;
  renderTabs();
  renderCart();
  switchView('terminal');
}

// ═══════════════════════════════════════════
// STAFF CLOCK — view clock in/out status
// ═══════════════════════════════════════════

function renderMgmtClock() {
  const list = document.getElementById('mgmtClockList');

  // Build per-staff status from clockEntries (defined in features.js)
  const staffStatus = {};
  STAFF.forEach(s => {
    staffStatus[s.id] = { name: s.name, role: s.role, entries: [], status: 'out' };
  });

  if (typeof clockEntries !== 'undefined') {
    clockEntries.forEach(e => {
      if (!staffStatus[e.staffId]) {
        staffStatus[e.staffId] = { name: e.staffName, role: '', entries: [], status: 'out' };
      }
      staffStatus[e.staffId].entries.push(e);
    });
  }

  // Determine current status for each staff member
  const rows = Object.entries(staffStatus).map(([id, s]) => {
    const sorted = s.entries.sort((a, b) => new Date(a.time) - new Date(b.time));
    const last = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    const isClockedIn = last && last.type === 'in';

    // Calculate total hours worked today
    let totalMinutes = 0;
    let clockInTime = null;
    sorted.forEach(e => {
      if (e.type === 'in') {
        clockInTime = new Date(e.time);
      } else if (e.type === 'out' && clockInTime) {
        totalMinutes += Math.floor((new Date(e.time) - clockInTime) / 60000);
        clockInTime = null;
      }
    });
    // If still clocked in, add time to now
    if (isClockedIn && clockInTime) {
      totalMinutes += Math.floor((Date.now() - clockInTime) / 60000);
    }

    const hoursStr = totalMinutes > 0
      ? Math.floor(totalMinutes / 60) + 'h ' + (totalMinutes % 60) + 'm'
      : '—';
    const clockInStr = last && last.type === 'in'
      ? new Date(last.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : '';
    const clockOutStr = last && last.type === 'out'
      ? new Date(last.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : '';

    return { id, name: s.name, role: s.role, isClockedIn, hoursStr, clockInStr, clockOutStr, hasEntries: sorted.length > 0 };
  });

  // Sort: clocked in first, then by name
  rows.sort((a, b) => {
    if (a.isClockedIn !== b.isClockedIn) return a.isClockedIn ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Split into clocked in and not
  const clockedIn = rows.filter(r => r.isClockedIn);
  const clockedOut = rows.filter(r => !r.isClockedIn);

  let html = '';

  if (clockedIn.length > 0) {
    html += `<div class="clock-section-label">CLOCKED IN (${clockedIn.length})</div>`;
    html += `<table class="mgmt-table">
      <thead><tr><th>NAME</th><th>ROLE</th><th>IN AT</th><th>HOURS</th><th></th></tr></thead>
      <tbody>
        ${clockedIn.map(r => `<tr>
          <td><span class="clock-dot in"></span> ${r.name}</td>
          <td>${r.role}</td>
          <td>${r.clockInStr}</td>
          <td>${r.hoursStr}</td>
          <td><button class="mgmt-edit-btn" onclick="mgmtForceClockOut('${r.id}')">CLOCK OUT</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  if (clockedOut.length > 0) {
    html += `<div class="clock-section-label" style="margin-top:20px">NOT CLOCKED IN (${clockedOut.length})</div>`;
    html += `<table class="mgmt-table">
      <thead><tr><th>NAME</th><th>ROLE</th><th>LAST OUT</th><th>HOURS TODAY</th></tr></thead>
      <tbody>
        ${clockedOut.map(r => `<tr>
          <td><span class="clock-dot out"></span> ${r.name}</td>
          <td>${r.role}</td>
          <td>${r.clockOutStr || (r.hasEntries ? '' : '<span style="color:var(--ash)">no entry</span>')}</td>
          <td>${r.hoursStr}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  if (rows.length === 0) {
    html = '<div class="mgmt-empty">No staff configured</div>';
  }

  list.innerHTML = html;
}

function mgmtForceClockOut(staffId) {
  const staff = STAFF.find(s => s.id === staffId);
  if (!staff) return;

  // Check for open tabs
  const openTabs = tabs.filter(t =>
    (t.status === 'open' || t.status === 'sent') && t.createdBy === staff.id
  );
  if (openTabs.length > 0) {
    showToast(staff.name + ' has ' + openTabs.length + ' open tab(s) — close first');
    return;
  }

  // Show checkout report then clock out
  if (typeof pendingClockOutStaff !== 'undefined' && typeof showStaffCheckout === 'function') {
    pendingClockOutStaff = staff;
    showStaffCheckout(staff);
    return;
  }

  // Fallback — direct clock out
  if (typeof clockEntries !== 'undefined') {
    clockEntries.push({ staffId: staff.id, staffName: staff.name, type: 'out', time: new Date() });
  }
  renderMgmtClock();
  showToast(staff.name + ' clocked out');
}

// ═══════════════════════════════════════════
// CLOSED CHECKS — reopen, change tip
// ═══════════════════════════════════════════

function renderMgmtChecks() {
  const closed = tabs.filter(t => t.status === 'closed' || t.status === 'paid');
  const staffMap = {};
  STAFF.forEach(s => staffMap[s.id] = s.name);

  const list = document.getElementById('mgmtChecksList');

  if (closed.length === 0) {
    list.innerHTML = '<div class="mgmt-empty">No closed checks</div>';
    return;
  }

  // Most recent first
  const sorted = [...closed].sort((a, b) => new Date(b.closedAt || b.paidAt) - new Date(a.closedAt || a.paidAt));

  list.innerHTML = `
    <table class="mgmt-table">
      <thead><tr><th>CHECK</th><th>SERVER</th><th>METHOD</th><th>TOTAL</th><th>TIP</th><th>CLOSED</th><th></th></tr></thead>
      <tbody>
        ${sorted.map(t => {
          const total = tabTotal(t);
          const time = t.closedAt ? new Date(t.closedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
          return `<tr>
            <td>${t.name}</td>
            <td>${staffMap[t.createdBy] || '—'}</td>
            <td>${(t.payMethod || '—').toUpperCase()}</td>
            <td>$${total.toFixed(2)}</td>
            <td>$${(t.tipAmount || 0).toFixed(2)}</td>
            <td>${time}</td>
            <td>
              <button class="mgmt-edit-btn" onclick="openChangeTip('${t.id}')" style="margin-right:4px">TIP</button>
              <button class="mgmt-edit-btn" onclick="reopenCheck('${t.id}')">REOPEN</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function openChangeTip(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const sub = tabSubtotal(tab) - tabDiscountAmount(tab);
  const currentTip = tab.tipAmount || 0;

  document.getElementById('ecPanel').innerHTML = '';
  const modal = document.getElementById('editCheckModal');
  document.querySelector('#editCheckModal .modal-title').textContent = 'CHANGE TIP — ' + tab.name;
  document.querySelector('#editCheckModal .ec-actions').style.display = 'none';

  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">CURRENT TIP: $${currentTip.toFixed(2)}</div>
      <div class="form-row">
        <label class="form-label">NEW TIP $</label>
        <input type="number" id="changeTipAmount" class="form-input" step="0.01" min="0" value="${currentTip.toFixed(2)}" style="width:120px">
        <button class="mgmt-action-btn" onclick="submitChangeTip('${tabId}')" style="margin-left:8px">SAVE</button>
      </div>
      <div class="ec-discount-btns" style="margin-top:8px">
        <button class="ec-disc-btn" onclick="document.getElementById('changeTipAmount').value=(${sub}*0.18).toFixed(2)">18%</button>
        <button class="ec-disc-btn" onclick="document.getElementById('changeTipAmount').value=(${sub}*0.20).toFixed(2)">20%</button>
        <button class="ec-disc-btn" onclick="document.getElementById('changeTipAmount').value=(${sub}*0.25).toFixed(2)">25%</button>
      </div>
    </div>`;

  openModal('editCheckModal');
}

function submitChangeTip(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const amount = parseFloat(document.getElementById('changeTipAmount').value);
  if (isNaN(amount) || amount < 0) { showToast('Invalid tip amount'); return; }

  tab.tipAmount = amount;
  const sub = tabSubtotal(tab) - tabDiscountAmount(tab);
  tab.tipPct = sub > 0 ? amount / sub : 0;

  closeModal('editCheckModal');
  // Restore edit check modal state
  document.querySelector('#editCheckModal .modal-title').textContent = 'EDIT CHECK';
  document.querySelector('#editCheckModal .ec-actions').style.display = '';

  renderMgmtChecks();
  showToast('Tip updated to $' + amount.toFixed(2));
}

function reopenCheck(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  tab.status = 'sent';
  tab.closedAt = null;
  tab.paidAt = null;
  tab.payMethod = null;
  tab.tipPct = 0;
  tab.tipAmount = 0;

  // Restore line statuses
  tab.lines.forEach(l => {
    if (l.status === 'served') l.status = 'sent';
  });

  activeTabId = tab.id;
  renderTabs();
  renderCart();
  switchView('terminal');
  showToast(tab.name + ' reopened');
}
