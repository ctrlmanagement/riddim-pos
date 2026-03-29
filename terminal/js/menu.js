/* RIDDIM POS — Menu Rendering */
'use strict';

// ═══════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════

function renderCategories() {
  const bar = document.getElementById('categoryBar');
  bar.innerHTML = MENU_CATEGORIES.map(c =>
    `<button class="cat-btn ${c.id === activeCategory ? 'active' : ''}"
            onclick="selectCategory('${c.id}')">
      ${c.name}
    </button>`
  ).join('');
}

let _menuSearchTerm = '';
let _subcatActiveTab = null;

function selectCategory(catId) {
  activeCategory = catId;
  _menuSearchTerm = '';
  _subcatActiveTab = null;
  if (typeof _invActiveCat !== 'undefined') _invActiveCat = null;
  const searchInput = document.getElementById('menuSearchInput');
  if (searchInput) searchInput.value = '';
  renderCategories();
  renderMenu();
}

function onMenuSearch(term) {
  _menuSearchTerm = (term || '').toLowerCase().trim();
  renderMenu();
}

function clearMenuSearch() {
  _menuSearchTerm = '';
  const searchInput = document.getElementById('menuSearchInput');
  if (searchInput) searchInput.value = '';
  renderMenu();
}

// ═══════════════════════════════════════════
// MENU GRID
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// LONG-PRESS → QTY PICKER
// ═══════════════════════════════════════════

let _menuLongTimer = null;
let _menuLongFired = false;

function _menuTouchStart(el) {
  _menuLongFired = false;
  _menuLongTimer = setTimeout(() => {
    _menuLongFired = true;
    if (el.dataset.is86) return;
    openQtyPicker(el.dataset.itemId);
  }, 400);
}

function _menuTouchEnd(el) {
  clearTimeout(_menuLongTimer);
  if (_menuLongFired) return; // long-press handled it
  if (el.dataset.is86) {
    showToast("Item is 86'd");
  } else {
    // Route through modifier picker if modifiers are configured
    if (typeof openModifierPicker === 'function' && MODIFIER_GROUPS.length) {
      openModifierPicker(el.dataset.itemId, 1);
    } else {
      addToCart(el.dataset.itemId);
    }
  }
}

function _menuTouchCancel() {
  clearTimeout(_menuLongTimer);
  _menuLongFired = false;
}

function openQtyPicker(menuItemId) {
  const item = MENU_ITEMS.find(i => i.id === menuItemId);
  if (!item) return;
  document.getElementById('qtyPickerName').textContent = item.name;
  document.getElementById('qtyPickerPrice').textContent = '$' + item.price;
  document.getElementById('qtyPickerItemId').value = menuItemId;
  document.getElementById('qtyPickerValue').textContent = '1';
  openModal('qtyPickerModal');
}

function qtyPickerSet(n) {
  document.getElementById('qtyPickerValue').textContent = n;
}

function qtyPickerAdjust(delta) {
  const el = document.getElementById('qtyPickerValue');
  const cur = parseInt(el.textContent) || 1;
  el.textContent = Math.max(1, Math.min(99, cur + delta));
}

function qtyPickerConfirm() {
  const itemId = document.getElementById('qtyPickerItemId').value;
  const qty = parseInt(document.getElementById('qtyPickerValue').textContent) || 1;
  closeModal('qtyPickerModal');
  // Route through modifier picker if modifiers are configured
  if (typeof openModifierPicker === 'function' && MODIFIER_GROUPS.length) {
    openModifierPicker(itemId, qty);
  } else {
    for (let i = 0; i < qty; i++) {
      addToCart(itemId);
    }
  }
}

// ═══════════════════════════════════════════
// MENU GRID
// ═══════════════════════════════════════════

function renderMenu() {
  const grid = document.getElementById('menuGrid');

  // Stock Up — inventory request view (from inv_products at $0)
  if (!_menuSearchTerm && typeof isStockUpCategory === 'function' && isStockUpCategory(activeCategory)) {
    renderStockUp();
    return;
  }

  // BTL SVC — bottle sales view (from inv_products at bottle_price)
  if (!_menuSearchTerm && typeof isBtlSvcCategory === 'function' && isBtlSvcCategory(activeCategory)) {
    renderBtlSvc();
    return;
  }

  // Subcategory tab view — categories with many subcategories get the tab strip layout
  if (!_menuSearchTerm && _shouldUseSubcatTabs(activeCategory)) {
    _renderSubcatTabView(activeCategory);
    return;
  }

  let items;
  if (_menuSearchTerm) {
    // Search across ALL categories
    items = MENU_ITEMS.filter(i => i.name.toLowerCase().includes(_menuSearchTerm));
  } else {
    items = MENU_ITEMS.filter(i => i.cat === activeCategory);
  }

  // Check if any items have subcategories — group them
  const hasSubcats = !_menuSearchTerm && items.some(i => i.subcategory);

  if (hasSubcats) {
    // Group by subcategory, preserving sort order
    const groups = [];
    const seen = new Set();
    items.forEach(item => {
      const sub = item.subcategory || 'OTHER';
      if (!seen.has(sub)) {
        seen.add(sub);
        groups.push({ label: sub, items: [] });
      }
      groups.find(g => g.label === sub).items.push(item);
    });

    grid.innerHTML = groups.map(g => {
      const header = `<div class="menu-subcat-header">${g.label}</div>`;
      const itemsHtml = g.items.map(item => _renderMenuItem(item)).join('');
      return header + itemsHtml;
    }).join('');
  } else {
    grid.innerHTML = items.map(item => _renderMenuItem(item)).join('');
  }
}

function _renderMenuItem(item) {
  const is86 = typeof isItem86 === 'function' && isItem86(item.id);
  const recipeBtn = item.recipe
    ? `<span class="menu-item-recipe" onclick="event.stopPropagation();openRecipe('${item.id}')" ontouchend="event.stopPropagation();" onmouseup="event.stopPropagation();">i</span>`
    : '';
  return `<div class="menu-item ${item.speedRail ? 'speed-rail' : ''} ${is86 ? 'eighty-sixed' : ''}"
        data-item-id="${item.id}" data-is86="${is86 ? '1' : ''}"
        ontouchstart="_menuTouchStart(this)" ontouchend="_menuTouchEnd(this)" ontouchcancel="_menuTouchCancel()"
        onmousedown="_menuTouchStart(this)" onmouseup="_menuTouchEnd(this)" onmouseleave="_menuTouchCancel()">
    ${recipeBtn}
    <span class="menu-item-name">${item.name}</span>
    <span class="menu-item-price">${is86 ? '86' : '$' + item.price}</span>
  </div>`;
}

// ═══════════════════════════════════════════
// SUBCATEGORY TAB VIEW (BTL SERVICE style)
// ═══════════════════════════════════════════

function _shouldUseSubcatTabs(catId) {
  const items = MENU_ITEMS.filter(i => i.cat === catId && i.subcategory);
  if (items.length < 4) return false;
  // Need at least 2 distinct subcategories
  const subs = new Set(items.map(i => i.subcategory));
  return subs.size >= 2;
}

function _renderSubcatTabView(catId) {
  const grid = document.getElementById('menuGrid');
  const items = MENU_ITEMS.filter(i => i.cat === catId);

  // Collect subcategories in sort order
  const subs = [];
  const seen = new Set();
  items.forEach(i => {
    const sub = i.subcategory || 'OTHER';
    if (!seen.has(sub)) {
      seen.add(sub);
      subs.push(sub);
    }
  });

  // Default to first subcategory
  if (!_subcatActiveTab || !seen.has(_subcatActiveTab)) {
    _subcatActiveTab = subs[0];
  }

  // Tab strip
  const tabs = subs.map(s =>
    `<button class="su-cat-btn ${s === _subcatActiveTab ? 'active' : ''}"
            onclick="_subcatSelect('${s.replace(/'/g, "\\'")}')">
      ${s}
    </button>`
  ).join('');

  // Filtered items
  const filtered = items.filter(i => (i.subcategory || 'OTHER') === _subcatActiveTab);
  const itemsHtml = filtered.map(item => _renderMenuItem(item)).join('');

  grid.innerHTML = `<div class="su-cat-strip">${tabs}</div>` + itemsHtml;
}

function _subcatSelect(sub) {
  _subcatActiveTab = sub;
  _renderSubcatTabView(activeCategory);
}


// ═══════════════════════════════════════════
// RECIPE VIEWER
// ═══════════════════════════════════════════

function openRecipe(menuItemId) {
  const item = MENU_ITEMS.find(i => i.id === menuItemId);
  if (!item || !item.recipe) return;

  const r = item.recipe;
  const body = document.getElementById('recipeBody');

  let html = `<div class="recipe-name">${item.name}</div>`;
  html += `<div class="recipe-price">$${item.price}</div>`;

  // Specs
  if (r.specs && r.specs.length) {
    html += '<div class="recipe-section-label">BUILD</div>';
    html += '<ul class="recipe-specs">';
    r.specs.forEach(s => { html += `<li>${s}</li>`; });
    html += '</ul>';
  }

  // Method
  if (r.method) {
    html += '<div class="recipe-section-label">METHOD</div>';
    html += `<div class="recipe-text">${r.method}</div>`;
  }

  // Glassware + Garnish
  if (r.glassware || r.garnish) {
    html += '<div class="recipe-meta">';
    if (r.glassware) html += `<span class="recipe-tag">${r.glassware}</span>`;
    if (r.garnish) html += `<span class="recipe-tag">${r.garnish}</span>`;
    html += '</div>';
  }

  // Shelf life (batched)
  if (r.shelfLife) {
    html += `<div class="recipe-shelf">Shelf life: ${r.shelfLife}</div>`;
  }

  body.innerHTML = html;
  openModal('recipeModal');
}
