/* RIDDIM POS — 86 List */
'use strict';

// ═══════════════════════════════════════════
// 86 LIST — Out-of-stock item management
// ═══════════════════════════════════════════

let eightySixSet = new Set(); // Set of menu item IDs that are 86'd

function open86List() {
  document.getElementById('eightySixSearch').value = '';
  render86List();
  openModal('eightySixModal');
}

function render86List() {
  const search = (document.getElementById('eightySixSearch')?.value || '').toLowerCase();
  let items = [...MENU_ITEMS];
  if (search) items = items.filter(i => i.name.toLowerCase().includes(search));

  // Sort: 86'd items first, then alphabetical
  items.sort((a, b) => {
    const a86 = eightySixSet.has(a.id) ? 0 : 1;
    const b86 = eightySixSet.has(b.id) ? 0 : 1;
    if (a86 !== b86) return a86 - b86;
    return a.name.localeCompare(b.name);
  });

  // Get category names
  const catMap = {};
  MENU_CATEGORIES.forEach(c => catMap[c.id] = c.name);

  const list = document.getElementById('eightySixList');
  list.innerHTML = items.map(i => {
    const is86 = eightySixSet.has(i.id);
    return `<div class="eightysix-row ${is86 ? 'is86' : ''}" onclick="toggle86('${i.id}')">
      <div class="eightysix-item">
        <span class="eightysix-name">${i.name}</span>
        <span class="eightysix-cat">${catMap[i.cat] || ''}</span>
      </div>
      <div class="eightysix-toggle">${is86 ? '86' : 'IN'}</div>
    </div>`;
  }).join('');
}

function toggle86(itemId) {
  const was86 = eightySixSet.has(itemId);
  if (was86) {
    eightySixSet.delete(itemId);
  } else {
    eightySixSet.add(itemId);
  }
  render86List();
  update86Badge();
  renderMenu(); // refresh menu grid to grey out 86'd items

  // Broadcast + audit
  if (typeof server86Toggle === 'function') server86Toggle(itemId, !was86);
  const item = MENU_ITEMS.find(i => i.id === itemId);
  if (typeof serverAuditLog === 'function') {
    serverAuditLog('86_toggle', {
      item_name: item ? item.name : itemId,
      is_86: !was86,
      station_code: STATION.code,
    });
  }
}

function update86Badge() {
  const countEl = document.getElementById('btn86Count');
  if (countEl) {
    countEl.textContent = eightySixSet.size > 0 ? '(' + eightySixSet.size + ')' : '';
  }
}

function isItem86(itemId) {
  return eightySixSet.has(itemId);
}
