/* RIDDIM POS — Modifier Picker */
'use strict';

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════

let _modPickerItemId = null;
let _modPickerQty = 1;
let _modSelections = {}; // { groupId: modifierId }

// ═══════════════════════════════════════════
// OPEN MODIFIER PICKER
// ═══════════════════════════════════════════

function openModifierPicker(menuItemId, qty) {
  if (!MODIFIER_GROUPS.length) {
    // No modifiers configured — add straight to cart
    _addToCartWithModifiers(menuItemId, qty || 1, [], 0, null);
    return;
  }

  const item = MENU_ITEMS.find(i => i.id === menuItemId);
  if (!item) return;

  _modPickerItemId = menuItemId;
  _modPickerQty = qty || 1;
  _modSelections = {};

  // Header — show base price
  document.getElementById('modifierItemName').textContent = item.name + '  $' + item.price;

  // Render groups
  const body = document.getElementById('modifierBody');
  body.innerHTML = MODIFIER_GROUPS.map(g => {
    const btns = g.modifiers.map(m => {
      const priceTag = m.price > 0 ? `<span class="mod-price">+$${m.price}</span>` : '';
      return `<button class="mod-btn" data-group="${g.id}" data-mod="${m.id}" data-name="${m.name}" data-price="${m.price}"
              onclick="toggleModifier('${g.id}','${m.id}',this)">
        ${m.name}${priceTag}
      </button>`;
    }).join('');
    return `<div class="mod-group">
      <div class="mod-group-label">${g.name.toUpperCase()}</div>
      <div class="mod-group-options">${btns}</div>
    </div>`;
  }).join('');

  // Upcharge total display
  body.innerHTML += '<div id="modUpchargeTotal" class="mod-upcharge-total" style="display:none"></div>';

  openModal('modifierModal');
}

// ═══════════════════════════════════════════
// TOGGLE SELECTION
// ═══════════════════════════════════════════

function toggleModifier(groupId, modId, el) {
  // Deselect if already selected
  if (_modSelections[groupId] === modId) {
    delete _modSelections[groupId];
    el.classList.remove('active');
    _updateUpchargeTotal();
    return;
  }

  // Deselect previous in same group
  const groupBtns = document.querySelectorAll(`.mod-btn[data-group="${groupId}"]`);
  groupBtns.forEach(b => b.classList.remove('active'));

  // Select this one
  _modSelections[groupId] = modId;
  el.classList.add('active');
  _updateUpchargeTotal();
}

function _updateUpchargeTotal() {
  const upcharge = _calcUpcharge();
  const el = document.getElementById('modUpchargeTotal');
  if (!el) return;

  if (upcharge > 0) {
    const item = MENU_ITEMS.find(i => i.id === _modPickerItemId);
    const base = item ? item.price : 0;
    el.textContent = `$${base} + $${upcharge.toFixed(2)} = $${(base + upcharge).toFixed(2)}`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

function _calcUpcharge() {
  let total = 0;
  MODIFIER_GROUPS.forEach(g => {
    const selId = _modSelections[g.id];
    if (selId) {
      const mod = g.modifiers.find(m => m.id === selId);
      if (mod && mod.price > 0) total += mod.price;
    }
  });
  return total;
}

// ═══════════════════════════════════════════
// CONFIRM / CLOSE
// ═══════════════════════════════════════════

function confirmModifiers() {
  const modNames = [];
  let upcharge = 0;
  let spiritInvProductId = null;

  // Collect selected modifier names + upcharge in group sort order
  MODIFIER_GROUPS.forEach(g => {
    const selId = _modSelections[g.id];
    if (selId) {
      const mod = g.modifiers.find(m => m.id === selId);
      if (mod) {
        modNames.push(mod.price > 0 ? `${mod.name} (+$${mod.price})` : mod.name);
        if (mod.price > 0) upcharge += mod.price;
        // Spirit upgrade → swap inv_product_id to upgrade spirit
        if (mod.invProductId) spiritInvProductId = mod.invProductId;
      }
    }
  });

  closeModal('modifierModal');
  _addToCartWithModifiers(_modPickerItemId, _modPickerQty, modNames, upcharge, spiritInvProductId);
}

function closeModifierPicker() {
  closeModal('modifierModal');
  // SKIP = add without modifiers
  if (_modPickerItemId) {
    _addToCartWithModifiers(_modPickerItemId, _modPickerQty, [], 0, null);
  }
  _modPickerItemId = null;
}

// ═══════════════════════════════════════════
// ADD TO CART WITH MODIFIERS
// ═══════════════════════════════════════════

async function _addToCartWithModifiers(menuItemId, qty, modifiers, upcharge, spiritInvProductId) {
  let tab = getActiveTab();
  if (!tab) {
    if (typeof pendingTableNum !== 'undefined' && pendingTableNum) {
      tab = await materializePendingTable();
    }
    if (!tab) {
      tab = await createTab();
    }
  }

  const item = MENU_ITEMS.find(i => i.id === menuItemId);
  if (!item) return;

  const seat = typeof getCurrentSeat === 'function' ? getCurrentSeat() : null;
  const linePrice = item.price + (upcharge || 0);

  // If no modifiers, check for qty merge on same unsent item (same as original behavior)
  if (modifiers.length === 0) {
    const existing = tab.lines.find(l =>
      l.menuItemId === menuItemId && l.status === 'pending' && !l.voided && l.seat === seat
      && (!l.modifiers || l.modifiers.length === 0)
    );
    if (existing) {
      existing.qty += qty;
      renderCart();
      renderTabs();
      return;
    }
  }

  for (let i = 0; i < qty; i++) {
    const newLine = {
      id: 'line-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      menuItemId: item.id,
      name: item.name,
      price: linePrice,
      qty: 1,
      seat: seat,
      status: 'pending',
      voided: false,
      comped: false,
      modifiers: modifiers,
      invProductId: spiritInvProductId || item.invProductId || null,
      addedAt: new Date(),
      addedBy: currentUser.id,
    };
    tab.lines.push(newLine);

    // Persist to local server
    if (typeof serverAddLines === 'function') serverAddLines(tab, [newLine]);
  }

  renderCart();
  renderTabs();
  _modPickerItemId = null;
}
