/* RIDDIM POS — Management: Products (inv_products) — Bottle Prices, Costs, PAR */
'use strict';

// ═══════════════════════════════════════════
// PRODUCTS CACHE
// ═══════════════════════════════════════════

let _mgmtProducts = [];
let _mgmtProductsLoaded = false;

async function _loadMgmtProducts() {
  const { data, error } = await sb
    .from('inv_products')
    .select('id, name, category, subcategory, bottle_price, cost, par_level, active')
    .eq('active', true)
    .order('category')
    .order('subcategory')
    .order('name');
  if (error) {
    showToast('Failed to load products: ' + error.message, 'error');
    return;
  }
  _mgmtProducts = data || [];
  _mgmtProductsLoaded = true;
}

// ═══════════════════════════════════════════
// RENDER PRODUCTS TABLE
// ═══════════════════════════════════════════

async function renderMgmtProducts() {
  if (!_mgmtProductsLoaded) await _loadMgmtProducts();

  // Populate filter dropdown
  const filter = document.getElementById('mgmtProductFilter');
  const currentVal = filter.value;
  const cats = [...new Set(_mgmtProducts.map(p => p.category))].sort();
  filter.innerHTML = '<option value="all">All Categories</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
  filter.value = currentVal || 'all';

  // Filter + search
  const search = (document.getElementById('mgmtProductSearch')?.value || '').toLowerCase();
  let products = [..._mgmtProducts];
  if (filter.value !== 'all') products = products.filter(p => p.category === filter.value);
  if (search) products = products.filter(p => p.name.toLowerCase().includes(search));

  const list = document.getElementById('mgmtProductList');
  if (products.length === 0) {
    list.innerHTML = '<div class="mgmt-empty">No products found</div>';
    return;
  }

  list.innerHTML = `
    <table class="mgmt-table">
      <thead>
        <tr><th>NAME</th><th>CATEGORY</th><th>BTL PRICE</th><th>COST</th><th>PAR</th><th></th></tr>
      </thead>
      <tbody>
        ${products.map(p => {
          const btlPrice = p.bottle_price != null ? '$' + parseFloat(p.bottle_price).toFixed(0) : '<span style="color:#E57373">MKT</span>';
          const cost = p.cost != null ? '$' + parseFloat(p.cost).toFixed(2) : '<span style="color:var(--ash)">—</span>';
          const par = p.par_level != null ? p.par_level : '<span style="color:var(--ash)">—</span>';
          return `
          <tr>
            <td>${p.name}${p.subcategory ? ' <span style="color:#888;font-size:11px;">(' + p.subcategory + ')</span>' : ''}</td>
            <td style="font-size:11px">${p.category}</td>
            <td>${btlPrice}</td>
            <td>${cost}</td>
            <td>${par}</td>
            <td><button class="mgmt-edit-btn" onclick="openEditProduct('${p.id}')">EDIT</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ═══════════════════════════════════════════
// EDIT PRODUCT MODAL
// ═══════════════════════════════════════════

function openEditProduct(productId) {
  const p = _mgmtProducts.find(x => x.id === productId);
  if (!p) return;

  document.getElementById('editProductTitle').textContent = 'EDIT PRODUCT';
  document.getElementById('editProductId').value = p.id;
  document.getElementById('editProductName').value = p.name;
  document.getElementById('editProductCatSub').value = p.category + (p.subcategory ? ' / ' + p.subcategory : '');
  document.getElementById('editProductBottlePrice').value = p.bottle_price != null ? p.bottle_price : '';
  document.getElementById('editProductCost').value = p.cost != null ? p.cost : '';
  document.getElementById('editProductPar').value = p.par_level != null ? p.par_level : '';

  openModal('editProductModal');
}

async function saveProduct() {
  const id = document.getElementById('editProductId').value;
  if (!id) return;

  const bottlePriceVal = document.getElementById('editProductBottlePrice').value;
  const costVal = document.getElementById('editProductCost').value;
  const parVal = document.getElementById('editProductPar').value;

  const row = {
    bottle_price: bottlePriceVal !== '' ? parseFloat(bottlePriceVal) : null,
    cost: costVal !== '' ? parseFloat(costVal) : null,
    par_level: parVal !== '' ? parseFloat(parVal) : null,
  };

  const { error } = await sb.from('inv_products').update(row).eq('id', id);
  if (error) {
    showToast('Save failed: ' + error.message, 'error');
    return;
  }

  // Update local cache
  const p = _mgmtProducts.find(x => x.id === id);
  if (p) {
    p.bottle_price = row.bottle_price;
    p.cost = row.cost;
    p.par_level = row.par_level;
  }

  closeModal('editProductModal');
  renderMgmtProducts();
  showToast('Product updated');
}
