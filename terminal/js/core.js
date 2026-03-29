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
  venue_name: 'RIDDIM',
  venue_subtitle: 'SUPPER CLUB',
  venue_city: 'Atlanta, GA',
  receipt_footer: 'Thank you for dining with us!',
};

let STATION = { id: null, code: 'BAR1', label: 'Bar 1', pos: 'POS 1' };
const TERMINAL_NAME = new URLSearchParams(window.location.search).get('terminal') || 'POS';
let STAFF = [];
let MENU_CATEGORIES = [];
let MENU_ITEMS = [];
let STATIONS = [];
let SECURITY_GROUPS = []; // { id, name }
let MODIFIER_GROUPS = []; // { id, name, sortOrder, modifiers: [{id, name, sortOrder}] }

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
    if (data.venue_name) CONFIG.venue_name = data.venue_name;
    if (data.venue_subtitle) CONFIG.venue_subtitle = data.venue_subtitle;
    if (data.venue_city) CONFIG.venue_city = data.venue_city;
    if (data.receipt_footer) CONFIG.receipt_footer = data.receipt_footer;
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
    .select('id, name, price, category_id, speed_rail, sort_order, inv_product_id, subcategory, recipe, base_spirit_category_id')
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
      subcategory: i.subcategory || null,
      recipe: i.recipe || null,
      baseSpiritCategoryId: i.base_spirit_category_id || null,
    }));
  }
  if (error) console.error('Menu items load error:', error);
}

async function loadSecurityGroups() {
  const { data, error } = await sb
    .from('pos_security_groups')
    .select('id, name');
  if (data) SECURITY_GROUPS = data;
  if (error) console.error('Security groups load error:', error);
}

async function loadModifiers() {
  const [groupRes, modRes] = await Promise.all([
    sb.from('pos_modifier_groups').select('id, name, sort_order').eq('active', true).order('sort_order'),
    sb.from('pos_modifiers').select('id, group_id, name, sort_order, price, inv_product_id').eq('active', true).order('sort_order'),
  ]);
  if (groupRes.error) { console.error('Modifier groups load error:', groupRes.error); return; }
  if (modRes.error) { console.error('Modifiers load error:', modRes.error); return; }

  const modsByGroup = {};
  (modRes.data || []).forEach(m => {
    (modsByGroup[m.group_id] = modsByGroup[m.group_id] || []).push({
      id: m.id, name: m.name, sortOrder: m.sort_order, price: parseFloat(m.price) || 0, invProductId: m.inv_product_id || null,
    });
  });

  MODIFIER_GROUPS = (groupRes.data || []).map(g => ({
    id: g.id,
    name: g.name,
    sortOrder: g.sort_order,
    modifiers: modsByGroup[g.id] || [],
  }));
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
    loadSecurityGroups(),
    loadModifiers(),
    typeof loadTableMinimums === 'function' ? loadTableMinimums() : Promise.resolve(),
  ]);

  // Map security group names to staff for role hierarchy
  const groupMap = {};
  SECURITY_GROUPS.forEach(g => groupMap[g.id] = g.name);
  STAFF.forEach(s => {
    if (s.securityGroupId && groupMap[s.securityGroupId]) {
      s.groupName = groupMap[s.securityGroupId].toLowerCase();
    }
  });
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
// ROLE HIERARCHY
// ═══════════════════════════════════════════

const ROLE_LEVEL = {
  barback: 1, hostess: 1, kitchen: 1,
  bartender: 2, cashier: 2, server: 2, waitress: 2,
  'riddim bartender': 2,
  manager: 3,
  gm: 4,
  owner: 5,
};

// Get role level for a staff member — uses security group name first, then pos_role
function getRoleLevel(roleOrStaff) {
  if (typeof roleOrStaff === 'object' && roleOrStaff !== null) {
    // Staff object — check groupName first (from security group), then pos_role
    const groupLevel = ROLE_LEVEL[(roleOrStaff.groupName || '').toLowerCase()];
    if (groupLevel) return groupLevel;
    return ROLE_LEVEL[(roleOrStaff.role || '').toLowerCase()] || 2;
  }
  // Plain string role
  return ROLE_LEVEL[(roleOrStaff || '').toLowerCase()] || 2;
}

// Filter tabs visible to the current user based on role hierarchy
function getVisibleTabs(statusFilter) {
  const myLevel = getRoleLevel(currentUser);
  const viewAll = hasPermission('tab.view_all');

  return tabs.filter(t => {
    if (statusFilter && !statusFilter.includes(t.status)) return false;
    // Always see own tabs
    if (t.createdBy === currentUser.id) return true;
    // Without view_all, only own tabs
    if (!viewAll) return false;
    // With view_all, see same-level and below (never above)
    const creator = STAFF.find(s => s.id === t.createdBy);
    if (!creator) return true; // unknown creator — show
    return getRoleLevel(creator) <= myLevel;
  });
}

// ═══════════════════════════════════════════
// SCREEN MANAGEMENT
// ═══════════════════════════════════════════

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

// ═══════════════════════════════════════════
// AUDIO FEEDBACK (Web Audio API — no files needed)
// ═══════════════════════════════════════════

let _audioCtx = null;
function posBeep(freq, duration, volume) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.frequency.value = freq || 800;
    gain.gain.value = volume || 0.15;
    osc.start();
    osc.stop(_audioCtx.currentTime + (duration || 0.1));
  } catch (e) { /* no audio support */ }
}

// ═══════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════

function showToast(msg, type) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:8px;font-family:"Bebas Neue",sans-serif;font-size:16px;letter-spacing:1px;z-index:9999;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(toast);
  }
  const colors = {
    error:   { bg: '#E74C3C', fg: '#FFFFFF' },
    success: { bg: '#27AE60', fg: '#FFFFFF' },
    warning: { bg: '#F39C12', fg: '#0A0A0A' },
  };
  const c = colors[type] || { bg: '#D4A843', fg: '#0A0A0A' };
  toast.style.background = c.bg;
  toast.style.color = c.fg;
  toast.textContent = msg;
  toast.style.opacity = '1';
  // Audio cue for errors
  if (type === 'error' && typeof posBeep === 'function') posBeep(300, 0.15);
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

// Custom confirm dialog (replaces browser confirm() which shows server URL)
function posConfirm(message) {
  return new Promise((resolve) => {
    const el = document.getElementById('confirmModal');
    document.getElementById('confirmMessage').textContent = message;
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');
    const cleanup = (result) => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeModal('confirmModal');
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    openModal('confirmModal');
  });
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
    closeModal('newTabModal');
    if (typeof openMemberLookup === 'function') {
      openMemberLookup();
    } else {
      createTab('Member', 'member');
    }
    return;
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

  // Member lookup modal — Escape to close
  if (document.getElementById('memberLookupModal') && document.getElementById('memberLookupModal').classList.contains('active')) {
    if (e.key === 'Escape') closeModal('memberLookupModal');
    return;
  }

  // Spirit upgrade modal — Escape to close
  if (document.getElementById('spiritUpgradeModal') && document.getElementById('spiritUpgradeModal').classList.contains('active')) {
    if (e.key === 'Escape') closeModal('spiritUpgradeModal');
    return;
  }

  // Recipe modal — Escape to close
  if (document.getElementById('recipeModal') && document.getElementById('recipeModal').classList.contains('active')) {
    if (e.key === 'Escape') closeModal('recipeModal');
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
