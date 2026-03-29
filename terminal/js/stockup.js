/* RIDDIM POS — Stock Up + BTL SVC (both render from inv_products) */
'use strict';

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════

const STOCKUP_CATEGORY_ID  = 'ae496448-8c2f-4865-9176-13a53478cb27';
const BTLSVC_CATEGORY_ID   = 'e8c47563-ee54-4b82-b40a-4d18772e02ba';

// Bar-related inventory categories
const INV_BAR_CATS = [
  'COGNAC', 'VODKA', 'WHISKEY', 'TEQUILA', 'RUM', 'GIN', 'SCOTCH',
  'CORDIAL', 'CHAMPAGNE', 'WINE', 'BEER', 'BEVERAGE',
];

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════

let _invProducts = [];          // loaded from inv_products
let _invLoaded = false;
let _invActiveCat = null;       // active inv category filter
let _invMode = null;            // 'stockup' or 'btlsvc'

// ═══════════════════════════════════════════
// LOAD INVENTORY PRODUCTS (shared, one load)
// ═══════════════════════════════════════════

async function _loadInvProducts() {
  if (_invLoaded) return;

  const { data, error } = await sb
    .from('inv_products')
    .select('id, name, category, subcategory, bottle_price')
    .eq('active', true)
    .in('category', INV_BAR_CATS)
    .order('category')
    .order('subcategory')
    .order('name');

  if (error) {
    console.error('Inventory load error:', error);
    showToast('Failed to load inventory', 'error');
    return;
  }

  _invProducts = data || [];
  _invLoaded = true;
}

// ═══════════════════════════════════════════
// DETECT CATEGORY TYPE
// ═══════════════════════════════════════════

function isStockUpCategory(catId) {
  return catId === STOCKUP_CATEGORY_ID;
}

function isBtlSvcCategory(catId) {
  return catId === BTLSVC_CATEGORY_ID;
}

// ═══════════════════════════════════════════
// RENDER — shared layout, different pricing
// ═══════════════════════════════════════════

async function renderStockUp() {
  _invMode = 'stockup';
  await _renderInvView();
}

async function renderBtlSvc() {
  _invMode = 'btlsvc';
  await _renderInvView();
}

async function _renderInvView() {
  await _loadInvProducts();

  const grid = document.getElementById('menuGrid');

  if (!_invProducts.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--ash);padding:40px;font-size:16px;">No inventory products found</div>';
    return;
  }

  // Get unique categories from loaded products
  const cats = [];
  const catSet = new Set();
  INV_BAR_CATS.forEach(c => {
    if (_invProducts.some(p => p.category === c)) {
      catSet.add(c);
      cats.push(c);
    }
  });

  if (!_invActiveCat || !catSet.has(_invActiveCat)) {
    _invActiveCat = cats[0];
  }

  // Category tab strip
  const catTabs = cats.map(c =>
    `<button class="su-cat-btn ${c === _invActiveCat ? 'active' : ''}"
            onclick="_invSelectCat('${c}')">
      ${c}
    </button>`
  ).join('');

  // Filter products for active category
  const items = _invProducts.filter(p => p.category === _invActiveCat);

  // Group by subcategory
  const hasSubcats = items.some(p => p.subcategory);
  let itemsHtml = '';

  if (hasSubcats) {
    const groups = [];
    const seen = new Set();
    items.forEach(p => {
      const sub = p.subcategory || 'OTHER';
      if (!seen.has(sub)) {
        seen.add(sub);
        groups.push({ label: sub, items: [] });
      }
      groups.find(g => g.label === sub).items.push(p);
    });

    itemsHtml = groups.map(g => {
      const header = `<div class="menu-subcat-header">${g.label}</div>`;
      const rows = g.items.map(p => _renderInvItem(p)).join('');
      return header + rows;
    }).join('');
  } else {
    itemsHtml = items.map(p => _renderInvItem(p)).join('');
  }

  grid.innerHTML =
    `<div class="su-cat-strip">${catTabs}</div>` +
    itemsHtml;
}

function _renderInvItem(product) {
  const escapedName = product.name.replace(/'/g, "\\'");

  if (_invMode === 'stockup') {
    return `<div class="menu-item su-item"
          onclick="_addStockUpToCart('${product.id}','${escapedName}','${product.category}')"
          onmousedown="" onmouseup="" ontouchstart="" ontouchend="">
      <span class="menu-item-name">${product.name}</span>
      <span class="menu-item-price su-price">REQ</span>
    </div>`;
  }

  // BTL SVC mode
  const price = product.bottle_price;
  const priceLabel = price ? '$' + parseFloat(price).toFixed(0) : 'MARKET';
  const priceClass = price ? '' : 'su-price';

  return `<div class="menu-item ${price ? '' : 'btl-market'}"
        onclick="_addBtlSvcToCart('${product.id}','${escapedName}',${price || 0},'${product.category}')"
        onmousedown="" onmouseup="" ontouchstart="" ontouchend="">
    <span class="menu-item-name">${product.name}</span>
    <span class="menu-item-price ${priceClass}">${priceLabel}</span>
  </div>`;
}

function _invSelectCat(cat) {
  _invActiveCat = cat;
  _renderInvView();
}

// ═══════════════════════════════════════════
// STOCK UP — $0.00 inventory transfer request
// ═══════════════════════════════════════════

async function _addStockUpToCart(productId, productName, category) {
  let tab = getActiveTab();
  if (!tab) {
    if (typeof pendingTableNum !== 'undefined' && pendingTableNum) {
      tab = await materializePendingTable();
    }
    if (!tab) {
      tab = await createTab();
    }
  }

  const newLine = {
    id: 'line-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    menuItemId: null,
    name: 'SU: ' + productName,
    price: 0,
    qty: 1,
    seat: null,
    status: 'pending',
    voided: false,
    comped: false,
    modifiers: [],
    invProductId: productId,
    stockUp: true,
    stockUpCategory: category,
    addedAt: new Date(),
    addedBy: currentUser.id,
  };

  // Merge qty if same product already pending
  const existing = tab.lines.find(l =>
    l.stockUp && l.invProductId === productId && l.status === 'pending' && !l.voided
  );
  if (existing) {
    existing.qty += 1;
  } else {
    tab.lines.push(newLine);
    if (typeof serverAddLines === 'function') serverAddLines(tab, [newLine]);
  }

  renderCart();
  renderTabs();
  posBeep(600, 0.06);
}

// ═══════════════════════════════════════════
// BTL SVC — bottle sale at bottle_price or MARKET
// ═══════════════════════════════════════════

async function _addBtlSvcToCart(productId, productName, price, category) {
  // MARKET items (price = 0) — owner/GM only
  if (!price || price <= 0) {
    const userLevel = getRoleLevel(currentUser);
    if (userLevel < 4) { // below GM
      showToast('MARKET price — owner or GM must ring this item', 'error');
      return;
    }
    // Prompt for price
    const entered = prompt('Enter bottle price for ' + productName + ':');
    if (!entered) return;
    price = parseFloat(entered);
    if (isNaN(price) || price <= 0) {
      showToast('Invalid price', 'error');
      return;
    }
  }

  let tab = getActiveTab();
  if (!tab) {
    if (typeof pendingTableNum !== 'undefined' && pendingTableNum) {
      tab = await materializePendingTable();
    }
    if (!tab) {
      tab = await createTab();
    }
  }

  const newLine = {
    id: 'line-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    menuItemId: null,
    name: productName + ' (Btl)',
    price: price,
    qty: 1,
    seat: null,
    status: 'pending',
    voided: false,
    comped: false,
    modifiers: [],
    invProductId: productId,
    addedAt: new Date(),
    addedBy: currentUser.id,
  };

  tab.lines.push(newLine);
  if (typeof serverAddLines === 'function') serverAddLines(tab, [newLine]);

  renderCart();
  renderTabs();
  posBeep(800, 0.08);
}

// ═══════════════════════════════════════════
// WRITE STOCK-UP TO inv_stock_ups ON FIRE
// ═══════════════════════════════════════════

async function writeStockUps(tab) {
  const suLines = tab.lines.filter(l => l.stockUp && !l.voided);
  if (!suLines.length) return;

  const importId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);

  const rows = suLines.map(l => ({
    import_id: importId,
    pos_item_id: null,
    pos_name: l.name.replace('SU: ', ''),
    pos_category: 'SU_' + (l.stockUpCategory || ''),
    product_id: l.invProductId || null,
    quantity: l.qty,
    from_location: 'LR',
    to_location: STATION.code,
    report_date: today,
    imported_by: currentUser.name + ' (POS)',
  }));

  const { error } = await sb.from('inv_stock_ups').insert(rows);
  if (error) {
    console.error('Stock-up write error:', error);
    showToast('Stock-up request failed to save', 'error');
  } else {
    showToast(suLines.length + ' item' + (suLines.length > 1 ? 's' : '') + ' requested from LR', 'success');
  }
}
