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

function selectCategory(catId) {
  activeCategory = catId;
  renderCategories();
  renderMenu();
}

// ═══════════════════════════════════════════
// MENU GRID
// ═══════════════════════════════════════════

function handleMenuItemClick(el) {
  if (el.dataset.is86) {
    showToast("Item is 86'd");
  } else {
    addToCart(el.dataset.itemId);
  }
}

function renderMenu() {
  const grid = document.getElementById('menuGrid');
  const items = MENU_ITEMS.filter(i => i.cat === activeCategory);
  grid.innerHTML = items.map(item => {
    const is86 = typeof isItem86 === 'function' && isItem86(item.id);
    return `<div class="menu-item ${item.speedRail ? 'speed-rail' : ''} ${is86 ? 'eighty-sixed' : ''}"
          data-item-id="${item.id}" data-is86="${is86 ? '1' : ''}"
          onclick="handleMenuItemClick(this)">
      <span class="menu-item-name">${item.name}</span>
      <span class="menu-item-price">${is86 ? '86' : '$' + item.price}</span>
    </div>`;
  }).join('');
}
