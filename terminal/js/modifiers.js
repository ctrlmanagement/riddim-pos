/* RIDDIM POS — Modifier Picker + Dynamic Spirit Upgrade */
'use strict';

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════

let _modPickerItemId = null;
let _modPickerQty = 1;
let _modSelections = {}; // { groupId: modifierId }
let _spiritUpgradeSelection = null; // { id, name, price, upcharge, invProductId }

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
  _spiritUpgradeSelection = null;

  // Header — show base price
  document.getElementById('modifierItemName').textContent = item.name + '  $' + item.price;

  // Filter out the Spirit group — spirit upgrades handled by separate picker
  const standardGroups = MODIFIER_GROUPS.filter(g => g.name.toLowerCase() !== 'spirit');

  // Render standard groups (Ice, Mix, Garnish, Prep)
  const body = document.getElementById('modifierBody');
  body.innerHTML = standardGroups.map(g => {
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

  // Spirit Upgrade button — only if the item has a base spirit category
  if (item.baseSpiritCategoryId) {
    body.innerHTML += `
      <div class="mod-group">
        <div class="mod-group-label">SPIRIT</div>
        <div class="mod-group-options">
          <button class="mod-btn mod-spirit-upgrade-btn" id="spiritUpgradeBtn" onclick="openSpiritUpgrade()">
            UPGRADE SPIRIT
          </button>
        </div>
        <div id="spiritUpgradeTag" class="spirit-upgrade-tag" style="display:none"></div>
      </div>`;
  }

  // Upcharge total display
  body.innerHTML += '<div id="modUpchargeTotal" class="mod-upcharge-total" style="display:none"></div>';

  openModal('modifierModal');
}

// ═══════════════════════════════════════════
// TOGGLE SELECTION (standard groups)
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
  const upcharge = _calcTotalUpcharge();
  const el = document.getElementById('modUpchargeTotal');
  if (!el) return;

  if (upcharge > 0) {
    const item = MENU_ITEMS.find(i => i.id === _modPickerItemId);
    const total = (item ? item.price : 0) + upcharge;
    el.textContent = `$${total.toFixed(2)}`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

function _calcTotalUpcharge() {
  let total = 0;
  // Standard modifier upcharges
  MODIFIER_GROUPS.forEach(g => {
    const selId = _modSelections[g.id];
    if (selId) {
      const mod = g.modifiers.find(m => m.id === selId);
      if (mod && mod.price > 0) total += mod.price;
    }
  });
  // Spirit upgrade upcharge
  if (_spiritUpgradeSelection) {
    total += _spiritUpgradeSelection.upcharge;
  }
  return total;
}

// ═══════════════════════════════════════════
// SPIRIT UPGRADE PICKER (second modal)
// ═══════════════════════════════════════════

function openSpiritUpgrade() {
  const item = MENU_ITEMS.find(i => i.id === _modPickerItemId);
  if (!item || !item.baseSpiritCategoryId) return;

  // Get spirits from the matching category
  const spirits = MENU_ITEMS.filter(i =>
    i.cat === item.baseSpiritCategoryId && i.id !== item.id
  ).sort((a, b) => a.sortOrder - b.sortOrder);

  // Get category name for the header
  const cat = MENU_CATEGORIES.find(c => c.id === item.baseSpiritCategoryId);
  const catName = cat ? cat.name.toUpperCase() : 'SPIRITS';

  const header = document.getElementById('spiritUpgradeHeader');
  header.textContent = catName + ' UPGRADE';

  const body = document.getElementById('spiritUpgradeBody');

  if (!spirits.length) {
    body.innerHTML = '<div style="color:var(--ash);padding:20px;text-align:center">No spirits in this category</div>';
    openModal('spiritUpgradeModal');
    return;
  }

  // Group by subcategory if present
  const hasSubcats = spirits.some(s => s.subcategory);

  if (hasSubcats) {
    const groups = [];
    const seen = new Set();
    spirits.forEach(s => {
      const sub = s.subcategory || 'OTHER';
      if (!seen.has(sub)) {
        seen.add(sub);
        groups.push({ label: sub, items: [] });
      }
      groups.find(g => g.label === sub).items.push(s);
    });

    body.innerHTML = groups.map(g => {
      const header = `<div class="spirit-subcat-header">${g.label}</div>`;
      const btns = g.items.map(s => _renderSpiritBtn(s, item.price)).join('');
      return header + `<div class="spirit-upgrade-options">${btns}</div>`;
    }).join('');
  } else {
    body.innerHTML = `<div class="spirit-upgrade-options">
      ${spirits.map(s => _renderSpiritBtn(s, item.price)).join('')}
    </div>`;
  }

  openModal('spiritUpgradeModal');
}

function _renderSpiritBtn(spirit, cocktailPrice) {
  const upcharge = Math.max(0, spirit.price - cocktailPrice + 2);
  const totalPrice = cocktailPrice + upcharge;
  const priceTag = `<span class="mod-price">$${totalPrice.toFixed(0)}</span>`;
  const isSelected = _spiritUpgradeSelection && _spiritUpgradeSelection.id === spirit.id;
  return `<button class="mod-btn spirit-btn ${isSelected ? 'active' : ''}"
          data-spirit-id="${spirit.id}"
          onclick="selectSpiritUpgrade('${spirit.id}')">
    ${spirit.name}${priceTag}
  </button>`;
}

function selectSpiritUpgrade(spiritId) {
  const item = MENU_ITEMS.find(i => i.id === _modPickerItemId);
  if (!item) return;

  const spirit = MENU_ITEMS.find(i => i.id === spiritId);
  if (!spirit) return;

  // Toggle off if already selected
  if (_spiritUpgradeSelection && _spiritUpgradeSelection.id === spiritId) {
    _spiritUpgradeSelection = null;
  } else {
    const upcharge = Math.max(0, spirit.price - item.price + 2);
    _spiritUpgradeSelection = {
      id: spirit.id,
      name: spirit.name,
      price: spirit.price,
      upcharge: upcharge,
      invProductId: spirit.invProductId || null,
    };
  }

  // Close spirit modal, update main picker
  closeModal('spiritUpgradeModal');
  _updateSpiritTag();
  _updateUpchargeTotal();
}

function clearSpiritUpgrade() {
  _spiritUpgradeSelection = null;
  closeModal('spiritUpgradeModal');
  _updateSpiritTag();
  _updateUpchargeTotal();
}

function _updateSpiritTag() {
  const tag = document.getElementById('spiritUpgradeTag');
  const btn = document.getElementById('spiritUpgradeBtn');
  if (!tag || !btn) return;

  if (_spiritUpgradeSelection) {
    const s = _spiritUpgradeSelection;
    const item = MENU_ITEMS.find(i => i.id === _modPickerItemId);
    const total = (item ? item.price : 0) + s.upcharge;
    tag.textContent = s.name + ` $${total.toFixed(0)}`;
    tag.style.display = '';
    btn.classList.add('active');
    btn.textContent = _spiritUpgradeSelection.name;
  } else {
    tag.style.display = 'none';
    btn.classList.remove('active');
    btn.textContent = 'UPGRADE SPIRIT';
  }
}

// ═══════════════════════════════════════════
// CONFIRM / CLOSE
// ═══════════════════════════════════════════

function confirmModifiers() {
  const modNames = [];
  let upcharge = 0;
  let spiritInvProductId = null;

  // Collect selected modifier names + upcharge in group sort order
  const standardGroups = MODIFIER_GROUPS.filter(g => g.name.toLowerCase() !== 'spirit');
  standardGroups.forEach(g => {
    const selId = _modSelections[g.id];
    if (selId) {
      const mod = g.modifiers.find(m => m.id === selId);
      if (mod) {
        modNames.push(mod.price > 0 ? `${mod.name} (+$${mod.price})` : mod.name);
        if (mod.price > 0) upcharge += mod.price;
      }
    }
  });

  // Spirit upgrade
  if (_spiritUpgradeSelection) {
    const s = _spiritUpgradeSelection;
    modNames.push(s.upcharge > 0 ? `${s.name} (+$${s.upcharge})` : s.name);
    upcharge += s.upcharge;
    spiritInvProductId = s.invProductId;
  }

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
