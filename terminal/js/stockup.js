/* RIDDIM POS — Stock Up (Inventory Request from LR) */
'use strict';

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════

const STOCKUP_CATEGORY_ID = 'ae496448-8c2f-4865-9176-13a53478cb27';

// Bar-related inventory categories to show in Stock Up
const STOCKUP_INV_CATS = [
  'COGNAC', 'VODKA', 'WHISKEY', 'TEQUILA', 'RUM', 'GIN', 'SCOTCH',
  'CORDIAL', 'CHAMPAGNE', 'WINE', 'BEER', 'BEVERAGE',
];

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════

let _stockUpProducts = [];      // loaded from inv_products
let _stockUpLoaded = false;
let _stockUpActiveCat = null;   // active inv category filter

// ═══════════════════════════════════════════
// LOAD INVENTORY PRODUCTS (on first Stock Up tap)
// ═══════════════════════════════════════════

async function _loadStockUpProducts() {
  if (_stockUpLoaded) return;

  const { data, error } = await sb
    .from('inv_products')
    .select('id, name, category, subcategory')
    .eq('active', true)
    .in('category', STOCKUP_INV_CATS)
    .order('category')
    .order('subcategory')
    .order('name');

  if (error) {
    console.error('Stock Up load error:', error);
    showToast('Failed to load inventory', 'error');
    return;
  }

  _stockUpProducts = data || [];
  _stockUpLoaded = true;
}

// ═══════════════════════════════════════════
// DETECT & RENDER STOCK UP VIEW
// ═══════════════════════════════════════════

function isStockUpCategory(catId) {
  return catId === STOCKUP_CATEGORY_ID;
}

async function renderStockUp() {
  await _loadStockUpProducts();

  const grid = document.getElementById('menuGrid');

  if (!_stockUpProducts.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--ash);padding:40px;font-size:16px;">No inventory products found</div>';
    return;
  }

  // Get unique categories from loaded products
  const cats = [];
  const catSet = new Set();
  STOCKUP_INV_CATS.forEach(c => {
    if (_stockUpProducts.some(p => p.category === c)) {
      catSet.add(c);
      cats.push(c);
    }
  });

  // Default to first category
  if (!_stockUpActiveCat || !catSet.has(_stockUpActiveCat)) {
    _stockUpActiveCat = cats[0];
  }

  // Category tab strip
  const catTabs = cats.map(c =>
    `<button class="su-cat-btn ${c === _stockUpActiveCat ? 'active' : ''}"
            onclick="_stockUpSelectCat('${c}')">
      ${c}
    </button>`
  ).join('');

  // Filter products for active category
  const items = _stockUpProducts.filter(p => p.category === _stockUpActiveCat);

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
      const rows = g.items.map(p => _renderStockUpItem(p)).join('');
      return header + rows;
    }).join('');
  } else {
    itemsHtml = items.map(p => _renderStockUpItem(p)).join('');
  }

  grid.innerHTML =
    `<div class="su-cat-strip">${catTabs}</div>` +
    itemsHtml;
}

function _renderStockUpItem(product) {
  return `<div class="menu-item su-item"
        onclick="_addStockUpToCart('${product.id}','${product.name.replace(/'/g, "\\'")}','${product.category}')"
        onmousedown="" onmouseup="" ontouchstart="" ontouchend="">
    <span class="menu-item-name">${product.name}</span>
    <span class="menu-item-price su-price">REQ</span>
  </div>`;
}

function _stockUpSelectCat(cat) {
  _stockUpActiveCat = cat;
  renderStockUp();
}

// ═══════════════════════════════════════════
// ADD STOCK UP REQUEST TO CART
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
    stockUp: true,               // flag for stock-up lines
    stockUpCategory: category,
    addedAt: new Date(),
    addedBy: currentUser.id,
  };

  // Check for existing pending stock-up of same product
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
