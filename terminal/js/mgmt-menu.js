/* RIDDIM POS — Management: Menu Item CRUD */
'use strict';

// ═══════════════════════════════════════════
// MENU ITEMS MANAGEMENT
// ═══════════════════════════════════════════

function renderMgmtMenu() {
  // Populate filter dropdown
  const filter = document.getElementById('mgmtMenuFilter');
  const currentVal = filter.value;
  filter.innerHTML = '<option value="all">All Categories</option>' +
    MENU_CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  filter.value = currentVal || 'all';

  // Filter + search
  const search = (document.getElementById('mgmtMenuSearch')?.value || '').toLowerCase();
  let items = [...MENU_ITEMS];
  if (filter.value !== 'all') items = items.filter(i => i.cat === filter.value);
  if (search) items = items.filter(i => i.name.toLowerCase().includes(search));

  // Get category names
  const catMap = {};
  MENU_CATEGORIES.forEach(c => catMap[c.id] = c.name);

  const list = document.getElementById('mgmtMenuList');
  if (items.length === 0) {
    list.innerHTML = '<div class="mgmt-empty">No items found</div>';
    return;
  }

  list.innerHTML = `
    <table class="mgmt-table">
      <thead>
        <tr><th>NAME</th><th>PRICE</th><th>CATEGORY</th><th>RAIL</th><th>SORT</th><th></th></tr>
      </thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td>${i.name}</td>
            <td>$${i.price.toFixed(2)}</td>
            <td>${catMap[i.cat] || '—'}</td>
            <td>${i.speedRail ? 'YES' : ''}</td>
            <td>${i.sortOrder || 0}</td>
            <td><button class="mgmt-edit-btn" onclick="openEditItemModal('${i.id}')">EDIT</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openAddItemModal() {
  document.getElementById('editItemTitle').textContent = 'ADD ITEM';
  document.getElementById('editItemId').value = '';
  document.getElementById('editItemName').value = '';
  document.getElementById('editItemPrice').value = '';
  document.getElementById('editItemSpeedRail').checked = false;
  document.getElementById('editItemSort').value = '0';
  document.getElementById('editItemDeleteBtn').style.display = 'none';

  // Populate category dropdown
  const sel = document.getElementById('editItemCategory');
  sel.innerHTML = MENU_CATEGORIES.map(c =>
    `<option value="${c.id}">${c.name}</option>`
  ).join('');

  openModal('editItemModal');
}

function openEditItemModal(itemId) {
  const item = MENU_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('editItemTitle').textContent = 'EDIT ITEM';
  document.getElementById('editItemId').value = item.id;
  document.getElementById('editItemName').value = item.name;
  document.getElementById('editItemPrice').value = item.price;
  document.getElementById('editItemSpeedRail').checked = item.speedRail;
  document.getElementById('editItemSort').value = item.sortOrder || 0;
  document.getElementById('editItemDeleteBtn').style.display = '';

  const sel = document.getElementById('editItemCategory');
  sel.innerHTML = MENU_CATEGORIES.map(c =>
    `<option value="${c.id}" ${c.id === item.cat ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  openModal('editItemModal');
}

async function saveMenuItem() {
  const id = document.getElementById('editItemId').value;
  const name = document.getElementById('editItemName').value.trim();
  const price = parseFloat(document.getElementById('editItemPrice').value);
  const categoryId = document.getElementById('editItemCategory').value;
  const speedRail = document.getElementById('editItemSpeedRail').checked;
  const sortOrder = parseInt(document.getElementById('editItemSort').value) || 0;

  if (!name || isNaN(price) || price < 0) {
    showToast('Name and valid price required');
    return;
  }

  const row = {
    name,
    price,
    category_id: categoryId,
    speed_rail: speedRail,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (id) {
    // Update
    ({ error } = await sb.from('pos_menu_items').update(row).eq('id', id));
  } else {
    // Insert
    row.active = true;
    ({ error } = await sb.from('pos_menu_items').insert(row));
  }

  if (error) {
    showToast('Save failed: ' + error.message);
    return;
  }

  closeModal('editItemModal');
  await loadMenuItems();
  renderMgmtMenu();
  showToast(id ? 'Item updated' : 'Item added');
}

async function deleteMenuItem() {
  const id = document.getElementById('editItemId').value;
  if (!id) return;

  // Soft delete — set active = false
  const { error } = await sb.from('pos_menu_items').update({ active: false }).eq('id', id);
  if (error) {
    showToast('Delete failed: ' + error.message);
    return;
  }

  closeModal('editItemModal');
  await loadMenuItems();
  renderMgmtMenu();
  showToast('Item removed');
}
