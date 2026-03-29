/* RIDDIM POS — Management: Menu Item CRUD */
'use strict';

// ═══════════════════════════════════════════
// INV_PRODUCTS CACHE (for SKU dropdown)
// ═══════════════════════════════════════════

let _mgmtInvProducts = []; // { id, name, category }

async function mgmtLoadInvProducts() {
  if (_mgmtInvProducts.length) return;
  const { data } = await sb
    .from('inv_products')
    .select('id, name, category, subcategory')
    .eq('active', true)
    .order('category')
    .order('name');
  _mgmtInvProducts = data || [];
}

function _invProductOptions(selectedId) {
  const grouped = {};
  _mgmtInvProducts.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });
  let html = '<option value="">— None —</option>';
  Object.keys(grouped).sort().forEach(cat => {
    html += `<optgroup label="${cat}">`;
    grouped[cat].forEach(p => {
      const sel = p.id === selectedId ? 'selected' : '';
      html += `<option value="${p.id}" ${sel}>${p.name}${p.subcategory ? ' (' + p.subcategory + ')' : ''}</option>`;
    });
    html += '</optgroup>';
  });
  return html;
}

// Spirit category options for base_spirit_category_id dropdown
const SPIRIT_CATEGORY_NAMES = ['VODKA','RUM','GIN','TEQUILA','WHISKEY','COGNAC','SCOTCH'];

function _spiritCategoryOptions(selectedId) {
  const spiritCats = MENU_CATEGORIES.filter(c => SPIRIT_CATEGORY_NAMES.includes(c.name));
  let html = '<option value="">— None (not a cocktail) —</option>';
  spiritCats.forEach(c => {
    const sel = c.id === selectedId ? 'selected' : '';
    html += `<option value="${c.id}" ${sel}>${c.name}</option>`;
  });
  return html;
}

// ═══════════════════════════════════════════
// RECIPE EDITOR
// ═══════════════════════════════════════════

function toggleRecipeEditor() {
  const section = document.getElementById('recipeEditorSection');
  const btn = document.getElementById('recipeToggleBtn');
  if (section.style.display === 'none') {
    section.style.display = '';
    btn.textContent = 'HIDE RECIPE';
    btn.style.borderColor = 'var(--gold)';
    btn.style.color = 'var(--gold)';
  } else {
    section.style.display = 'none';
    btn.textContent = 'RECIPE';
    btn.style.borderColor = 'var(--ash)';
    btn.style.color = 'var(--ash)';
  }
}

function _populateRecipeFields(recipe) {
  const section = document.getElementById('recipeEditorSection');
  const btn = document.getElementById('recipeToggleBtn');
  document.getElementById('editItemSpecs').value = '';
  document.getElementById('editItemMethod').value = '';
  document.getElementById('editItemGlassware').value = '';
  document.getElementById('editItemGarnish').value = '';

  if (recipe && (recipe.specs || recipe.method || recipe.glassware || recipe.garnish)) {
    document.getElementById('editItemSpecs').value = (recipe.specs || []).join('\n');
    document.getElementById('editItemMethod').value = recipe.method || '';
    document.getElementById('editItemGlassware').value = recipe.glassware || '';
    document.getElementById('editItemGarnish').value = recipe.garnish || '';
    // Auto-expand if recipe has data
    section.style.display = '';
    btn.textContent = 'HIDE RECIPE';
    btn.style.borderColor = 'var(--gold)';
    btn.style.color = 'var(--gold)';
  } else {
    section.style.display = 'none';
    btn.textContent = 'RECIPE';
    btn.style.borderColor = 'var(--ash)';
    btn.style.color = 'var(--ash)';
  }
}

function _buildRecipeJson() {
  const specsRaw = document.getElementById('editItemSpecs').value.trim();
  const method = document.getElementById('editItemMethod').value.trim();
  const glassware = document.getElementById('editItemGlassware').value.trim();
  const garnish = document.getElementById('editItemGarnish').value.trim();

  if (!specsRaw && !method && !glassware && !garnish) return null;

  const specs = specsRaw ? specsRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];
  const recipe = {};
  if (specs.length) recipe.specs = specs;
  if (method) recipe.method = method;
  if (glassware) recipe.glassware = glassware;
  if (garnish) recipe.garnish = garnish;
  return recipe;
}

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

  // Get category names + inv_product name map
  const catMap = {};
  MENU_CATEGORIES.forEach(c => catMap[c.id] = c.name);
  const invMap = {};
  _mgmtInvProducts.forEach(p => { invMap[p.id] = p.name; });

  const list = document.getElementById('mgmtMenuList');
  if (items.length === 0) {
    list.innerHTML = '<div class="mgmt-empty">No items found</div>';
    return;
  }

  list.innerHTML = `
    <table class="mgmt-table">
      <thead>
        <tr><th>NAME</th><th>PRICE</th><th>CATEGORY</th><th>INV SKU</th><th>RAIL</th><th>SORT</th><th></th></tr>
      </thead>
      <tbody>
        ${items.map(i => {
          const skuName = i.invProductId ? invMap[i.invProductId] || '?' : '';
          const skuStyle = i.invProductId ? '' : 'color:#E57373;';
          const skuLabel = i.invProductId ? skuName : 'UNLINKED';
          return `
          <tr>
            <td>${i.name}${i.subcategory ? ' <span style="color:#888;font-size:11px;">(' + i.subcategory + ')</span>' : ''}</td>
            <td>$${i.price.toFixed(2)}</td>
            <td>${catMap[i.cat] || '—'}</td>
            <td style="${skuStyle}font-size:11px;">${skuLabel}</td>
            <td>${i.speedRail ? 'YES' : ''}</td>
            <td>${i.sortOrder || 0}</td>
            <td><button class="mgmt-edit-btn" onclick="openEditItemModal('${i.id}')">EDIT</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function openAddItemModal() {
  await mgmtLoadInvProducts();
  document.getElementById('editItemTitle').textContent = 'ADD ITEM';
  document.getElementById('editItemId').value = '';
  document.getElementById('editItemName').value = '';
  document.getElementById('editItemPrice').value = '';
  document.getElementById('editItemSpeedRail').checked = false;
  document.getElementById('editItemSort').value = '0';
  document.getElementById('editItemSubcategory').value = '';
  document.getElementById('editItemDeleteBtn').style.display = 'none';

  // Populate category dropdown
  const sel = document.getElementById('editItemCategory');
  sel.innerHTML = MENU_CATEGORIES.map(c =>
    `<option value="${c.id}">${c.name}</option>`
  ).join('');

  // Populate inv_product dropdown
  document.getElementById('editItemInvProduct').innerHTML = _invProductOptions('');

  // Populate base spirit category dropdown
  document.getElementById('editItemBaseSpiritCat').innerHTML = _spiritCategoryOptions('');

  // Clear recipe fields
  _populateRecipeFields(null);

  openModal('editItemModal');
}

async function openEditItemModal(itemId) {
  await mgmtLoadInvProducts();
  const item = MENU_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('editItemTitle').textContent = 'EDIT ITEM';
  document.getElementById('editItemId').value = item.id;
  document.getElementById('editItemName').value = item.name;
  document.getElementById('editItemPrice').value = item.price;
  document.getElementById('editItemSpeedRail').checked = item.speedRail;
  document.getElementById('editItemSort').value = item.sortOrder || 0;
  document.getElementById('editItemSubcategory').value = item.subcategory || '';
  document.getElementById('editItemDeleteBtn').style.display = '';

  const sel = document.getElementById('editItemCategory');
  sel.innerHTML = MENU_CATEGORIES.map(c =>
    `<option value="${c.id}" ${c.id === item.cat ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  // Populate inv_product dropdown with current selection
  document.getElementById('editItemInvProduct').innerHTML = _invProductOptions(item.invProductId || '');

  // Populate base spirit category dropdown with current selection
  document.getElementById('editItemBaseSpiritCat').innerHTML = _spiritCategoryOptions(item.baseSpiritCategoryId || '');

  // Populate recipe fields
  _populateRecipeFields(item.recipe);

  openModal('editItemModal');
}

async function saveMenuItem() {
  const id = document.getElementById('editItemId').value;
  const name = document.getElementById('editItemName').value.trim();
  const price = parseFloat(document.getElementById('editItemPrice').value);
  const categoryId = document.getElementById('editItemCategory').value;
  const speedRail = document.getElementById('editItemSpeedRail').checked;
  const sortOrder = parseInt(document.getElementById('editItemSort').value) || 0;
  const invProductId = document.getElementById('editItemInvProduct').value || null;
  const subcategory = document.getElementById('editItemSubcategory').value.trim() || null;
  const baseSpiritCategoryId = document.getElementById('editItemBaseSpiritCat').value || null;
  const recipe = _buildRecipeJson();

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
    inv_product_id: invProductId,
    subcategory: subcategory,
    base_spirit_category_id: baseSpiritCategoryId,
    recipe: recipe,
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
