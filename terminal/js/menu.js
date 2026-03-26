/* RIDDIM POS — Menu Rendering */
'use strict';

// ═══════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════

function renderCategories() {
  const bar = document.getElementById('categoryBar');
  bar.innerHTML = MENU_CATEGORIES.map(c =>
    `<button class="cat-btn ${c.id === activeCategory ? 'active' : ''}"
            onclick="selectCategory('${c.id}')"
            ${c.color ? `style="color:${c.id === activeCategory ? '' : c.color}"` : ''}>
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

function renderMenu() {
  const grid = document.getElementById('menuGrid');
  const items = MENU_ITEMS.filter(i => i.cat === activeCategory);
  grid.innerHTML = items.map(item => {
    const is86 = typeof isItem86 === 'function' && isItem86(item.id);
    return `<div class="menu-item ${item.speedRail ? 'speed-rail' : ''} ${is86 ? 'eighty-sixed' : ''}"
          onclick="${is86 ? 'showToast(\'Item is 86\\\'d\')' : 'addToCart(\'' + item.id + '\')'}">
      <span class="menu-item-name">${item.name}</span>
      <span class="menu-item-price">${is86 ? '86' : '$' + item.price}</span>
    </div>`;
  }).join('');
}
