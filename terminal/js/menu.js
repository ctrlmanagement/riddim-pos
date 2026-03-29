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

function selectCategory(catId) {
  activeCategory = catId;
  _menuSearchTerm = '';
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
    addToCart(el.dataset.itemId);
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
  for (let i = 0; i < qty; i++) {
    addToCart(itemId);
  }
}

// ═══════════════════════════════════════════
// MENU GRID
// ═══════════════════════════════════════════

function renderMenu() {
  const grid = document.getElementById('menuGrid');
  let items;
  if (_menuSearchTerm) {
    // Search across ALL categories
    items = MENU_ITEMS.filter(i => i.name.toLowerCase().includes(_menuSearchTerm));
  } else {
    items = MENU_ITEMS.filter(i => i.cat === activeCategory);
  }
  grid.innerHTML = items.map(item => {
    const is86 = typeof isItem86 === 'function' && isItem86(item.id);
    return `<div class="menu-item ${item.speedRail ? 'speed-rail' : ''} ${is86 ? 'eighty-sixed' : ''}"
          data-item-id="${item.id}" data-is86="${is86 ? '1' : ''}"
          ontouchstart="_menuTouchStart(this)" ontouchend="_menuTouchEnd(this)" ontouchcancel="_menuTouchCancel()"
          onmousedown="_menuTouchStart(this)" onmouseup="_menuTouchEnd(this)" onmouseleave="_menuTouchCancel()">
      <span class="menu-item-name">${item.name}</span>
      <span class="menu-item-price">${is86 ? '86' : '$' + item.price}</span>
    </div>`;
  }).join('');
}
