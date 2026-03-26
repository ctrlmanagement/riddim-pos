/* RIDDIM POS — Management: Category CRUD */
'use strict';

// ═══════════════════════════════════════════
// CATEGORIES MANAGEMENT
// ═══════════════════════════════════════════

function renderMgmtCategories() {
  const list = document.getElementById('mgmtCategoryList');
  list.innerHTML = `
    <table class="mgmt-table">
      <thead>
        <tr><th>NAME</th><th>COLOR</th><th>SORT</th><th>ITEMS</th><th></th></tr>
      </thead>
      <tbody>
        ${MENU_CATEGORIES.map(c => {
          const count = MENU_ITEMS.filter(i => i.cat === c.id).length;
          return `
          <tr>
            <td>${c.name}</td>
            <td>${c.color ? `<span style="color:${c.color}">${c.color}</span>` : '—'}</td>
            <td>${c.sortOrder || 0}</td>
            <td>${count}</td>
            <td><button class="mgmt-edit-btn" onclick="openEditCategoryModal('${c.id}')">EDIT</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function openAddCategoryModal() {
  document.getElementById('editCatTitle').textContent = 'ADD CATEGORY';
  document.getElementById('editCatId').value = '';
  document.getElementById('editCatName').value = '';
  document.getElementById('editCatColor').value = '';
  document.getElementById('editCatSort').value = '0';
  openModal('editCategoryModal');
}

function openEditCategoryModal(catId) {
  const cat = MENU_CATEGORIES.find(c => c.id === catId);
  if (!cat) return;
  document.getElementById('editCatTitle').textContent = 'EDIT CATEGORY';
  document.getElementById('editCatId').value = cat.id;
  document.getElementById('editCatName').value = cat.name;
  document.getElementById('editCatColor').value = cat.color || '';
  document.getElementById('editCatSort').value = cat.sortOrder || 0;
  openModal('editCategoryModal');
}

async function saveCategory() {
  const id = document.getElementById('editCatId').value;
  const name = document.getElementById('editCatName').value.trim().toUpperCase();
  const color = document.getElementById('editCatColor').value.trim() || null;
  const sortOrder = parseInt(document.getElementById('editCatSort').value) || 0;

  if (!name) { showToast('Name required'); return; }

  const row = { name, color, sort_order: sortOrder };
  let error;
  if (id) {
    ({ error } = await sb.from('pos_menu_categories').update(row).eq('id', id));
  } else {
    row.active = true;
    ({ error } = await sb.from('pos_menu_categories').insert(row));
  }

  if (error) { showToast('Save failed: ' + error.message); return; }

  closeModal('editCategoryModal');
  await loadCategories();
  await loadMenuItems(); // refresh category mappings
  renderMgmtCategories();
  showToast(id ? 'Category updated' : 'Category added');
}
