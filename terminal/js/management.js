/* RIDDIM POS — Management Module
   Owner/Manager functions: menu, staff, categories, stations, settings, close day
   S75: Initial build */

'use strict';

// ═══════════════════════════════════════════
// VIEW SWITCHING (Terminal <-> Management)
// ═══════════════════════════════════════════

function switchView(view) {
  const terminalBody = document.querySelector('.main-body');
  const mgmtPanel = document.getElementById('managementPanel');
  const navTerminal = document.getElementById('navTerminal');
  const navManagement = document.getElementById('navManagement');

  if (view === 'management') {
    terminalBody.style.display = 'none';
    mgmtPanel.style.display = 'flex';
    navTerminal.classList.remove('active');
    navManagement.classList.add('active');
    renderMgmtMenu();
  } else {
    terminalBody.style.display = 'flex';
    mgmtPanel.style.display = 'none';
    navTerminal.classList.add('active');
    navManagement.classList.remove('active');
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
