/* RIDDIM POS — Management: Modifier CRUD */
'use strict';

// ═══════════════════════════════════════════
// RENDER ALL GROUPS + MODIFIERS
// ═══════════════════════════════════════════

function renderMgmtModifiers() {
  const list = document.getElementById('mgmtModifierList');

  if (!MODIFIER_GROUPS.length) {
    list.innerHTML = '<div class="mgmt-empty">No modifier groups configured</div>';
    return;
  }

  // Show all groups (including inactive Spirit group if it exists for reference)
  list.innerHTML = MODIFIER_GROUPS.map(g => {
    const modsHtml = g.modifiers.length
      ? `<table class="mgmt-table" style="margin:8px 0 0">
          <thead><tr><th>NAME</th><th>PRICE</th><th>SORT</th><th></th></tr></thead>
          <tbody>
            ${g.modifiers.map(m => `
              <tr>
                <td>${m.name}</td>
                <td>${m.price > 0 ? '+$' + m.price.toFixed(2) : '—'}</td>
                <td>${m.sortOrder}</td>
                <td><button class="mgmt-edit-btn" onclick="openEditModModal('${g.id}','${m.id}')">EDIT</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`
      : '<div style="color:var(--ash);font-size:12px;padding:8px 0">No options in this group</div>';

    return `
      <div style="margin-bottom:20px;border:1px solid var(--surface-active);border-radius:8px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div>
            <span style="font-family:var(--font-label);font-size:16px;letter-spacing:1px;color:var(--gold)">${g.name.toUpperCase()}</span>
            <span style="font-size:11px;color:var(--ash);margin-left:8px">sort: ${g.sortOrder}</span>
          </div>
          <div style="display:flex;gap:6px">
            <button class="mgmt-edit-btn" onclick="openEditGroupModal('${g.id}')">EDIT GROUP</button>
            <button class="mgmt-action-btn" style="font-size:11px;padding:4px 10px" onclick="openAddModModal('${g.id}')">+ ADD</button>
          </div>
        </div>
        ${modsHtml}
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════
// GROUP CRUD
// ═══════════════════════════════════════════

function openAddGroupModal() {
  document.getElementById('editGroupTitle').textContent = 'ADD GROUP';
  document.getElementById('editGroupId').value = '';
  document.getElementById('editGroupName').value = '';
  document.getElementById('editGroupSort').value = MODIFIER_GROUPS.length;
  document.getElementById('editGroupDeleteBtn').style.display = 'none';
  openModal('editGroupModal');
}

function openEditGroupModal(groupId) {
  const g = MODIFIER_GROUPS.find(x => x.id === groupId);
  if (!g) return;
  document.getElementById('editGroupTitle').textContent = 'EDIT GROUP';
  document.getElementById('editGroupId').value = g.id;
  document.getElementById('editGroupName').value = g.name;
  document.getElementById('editGroupSort').value = g.sortOrder;
  document.getElementById('editGroupDeleteBtn').style.display = '';
  openModal('editGroupModal');
}

async function saveModGroup() {
  const id = document.getElementById('editGroupId').value;
  const name = document.getElementById('editGroupName').value.trim();
  const sortOrder = parseInt(document.getElementById('editGroupSort').value) || 0;

  if (!name) {
    showToast('Group name required');
    return;
  }

  const row = { name, sort_order: sortOrder, active: true };
  let error;

  if (id) {
    ({ error } = await sb.from('pos_modifier_groups').update(row).eq('id', id));
  } else {
    ({ error } = await sb.from('pos_modifier_groups').insert(row));
  }

  if (error) {
    showToast('Save failed: ' + error.message, 'error');
    return;
  }

  closeModal('editGroupModal');
  await loadModifiers();
  renderMgmtModifiers();
  showToast(id ? 'Group updated' : 'Group added');
}

async function deleteModGroup() {
  const id = document.getElementById('editGroupId').value;
  if (!id) return;

  const g = MODIFIER_GROUPS.find(x => x.id === id);
  if (g && g.modifiers.length > 0) {
    const ok = await posConfirm('This group has ' + g.modifiers.length + ' modifier(s). Delete all?');
    if (!ok) return;
    // Soft delete all modifiers in the group
    await sb.from('pos_modifiers').update({ active: false }).eq('group_id', id);
  }

  const { error } = await sb.from('pos_modifier_groups').update({ active: false }).eq('id', id);
  if (error) {
    showToast('Delete failed: ' + error.message, 'error');
    return;
  }

  closeModal('editGroupModal');
  await loadModifiers();
  renderMgmtModifiers();
  showToast('Group removed');
}

// ═══════════════════════════════════════════
// MODIFIER CRUD
// ═══════════════════════════════════════════

async function openAddModModal(groupId) {
  await mgmtLoadInvProducts();
  const g = MODIFIER_GROUPS.find(x => x.id === groupId);
  document.getElementById('editModTitle').textContent = 'ADD TO ' + (g ? g.name.toUpperCase() : 'GROUP');
  document.getElementById('editModId').value = '';
  document.getElementById('editModGroupId').value = groupId;
  document.getElementById('editModName').value = '';
  document.getElementById('editModPrice').value = '0';
  document.getElementById('editModSort').value = g ? g.modifiers.length : 0;
  document.getElementById('editModInvProduct').innerHTML = _invProductOptions('');
  document.getElementById('editModDeleteBtn').style.display = 'none';
  openModal('editModModal');
}

async function openEditModModal(groupId, modId) {
  await mgmtLoadInvProducts();
  const g = MODIFIER_GROUPS.find(x => x.id === groupId);
  const m = g ? g.modifiers.find(x => x.id === modId) : null;
  if (!m) return;

  document.getElementById('editModTitle').textContent = 'EDIT MODIFIER';
  document.getElementById('editModId').value = m.id;
  document.getElementById('editModGroupId').value = groupId;
  document.getElementById('editModName').value = m.name;
  document.getElementById('editModPrice').value = m.price || 0;
  document.getElementById('editModSort').value = m.sortOrder || 0;
  document.getElementById('editModInvProduct').innerHTML = _invProductOptions(m.invProductId || '');
  document.getElementById('editModDeleteBtn').style.display = '';
  openModal('editModModal');
}

async function saveModifier() {
  const id = document.getElementById('editModId').value;
  const groupId = document.getElementById('editModGroupId').value;
  const name = document.getElementById('editModName').value.trim();
  const price = parseFloat(document.getElementById('editModPrice').value) || 0;
  const sortOrder = parseInt(document.getElementById('editModSort').value) || 0;
  const invProductId = document.getElementById('editModInvProduct').value || null;

  if (!name) {
    showToast('Modifier name required');
    return;
  }

  const row = {
    group_id: groupId,
    name,
    price,
    sort_order: sortOrder,
    inv_product_id: invProductId,
    active: true,
  };

  let error;
  if (id) {
    ({ error } = await sb.from('pos_modifiers').update(row).eq('id', id));
  } else {
    ({ error } = await sb.from('pos_modifiers').insert(row));
  }

  if (error) {
    showToast('Save failed: ' + error.message, 'error');
    return;
  }

  closeModal('editModModal');
  await loadModifiers();
  renderMgmtModifiers();
  showToast(id ? 'Modifier updated' : 'Modifier added');
}

async function deleteModifier() {
  const id = document.getElementById('editModId').value;
  if (!id) return;

  const { error } = await sb.from('pos_modifiers').update({ active: false }).eq('id', id);
  if (error) {
    showToast('Delete failed: ' + error.message, 'error');
    return;
  }

  closeModal('editModModal');
  await loadModifiers();
  renderMgmtModifiers();
  showToast('Modifier removed');
}
