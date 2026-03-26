/* RIDDIM POS — Core */
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
    .select('id, first_name, last_name, phone, role, pos_pin, pos_role, security_group_id, active')
    .eq('active', true)
    .not('pos_pin', 'is', null);
  if (data) {
    STAFF = data.map(s => ({
      id: s.id,
      name: s.first_name + (s.last_name ? ' ' + s.last_name.charAt(0) + '.' : ''),
      fullName: s.first_name + ' ' + (s.last_name || ''),
      pin: s.pos_pin,
      role: s.pos_role || 'bartender',
      securityGroupId: s.security_group_id || null,
      permissions: new Set(), // populated at login
    }));
  }
  if (error) console.error('Staff load error:', error);
}

// Load permissions for a specific security group
async function loadPermissions(groupId) {
  if (!groupId) return new Set();
  const { data, error } = await sb
    .from('pos_security_permissions')
    .select('permission')
    .eq('group_id', groupId)
    .eq('enabled', true);
  if (error) { console.error('Permissions load error:', error); return new Set(); }
  return new Set((data || []).map(p => p.permission));
}

// Permission check — used by all terminal modules
function hasPermission(key) {
  if (!currentUser) return false;
  return currentUser.permissions.has(key);
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

  // Receipt modal — Escape to close
  if (document.getElementById('receiptModal').classList.contains('active')) {
    if (e.key === 'Escape') closeReceipt();
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
