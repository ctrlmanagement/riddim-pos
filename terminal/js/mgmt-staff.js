/* RIDDIM POS — Management: Staff / PIN Management */
'use strict';

// ═══════════════════════════════════════════
// STAFF / PINS MANAGEMENT
// ═══════════════════════════════════════════

let allStaffForMgmt = [];

async function renderMgmtStaff() {
  // Load ALL staff (not just POS-enabled)
  const { data, error } = await sb
    .from('staff')
    .select('id, first_name, last_name, phone, role, pos_pin, pos_role, active')
    .eq('active', true)
    .order('first_name');

  if (error) { showToast('Failed to load staff'); return; }
  allStaffForMgmt = data || [];

  const list = document.getElementById('mgmtStaffList');
  list.innerHTML = `
    <table class="mgmt-table">
      <thead>
        <tr><th>NAME</th><th>ROLE</th><th>POS PIN</th><th>POS ROLE</th><th></th></tr>
      </thead>
      <tbody>
        ${allStaffForMgmt.map(s => `
          <tr>
            <td>${s.first_name} ${s.last_name || ''}</td>
            <td>${s.role || '—'}</td>
            <td>${s.pos_pin || '<span style="color:var(--ash)">none</span>'}</td>
            <td>${s.pos_role || '<span style="color:var(--ash)">no access</span>'}</td>
            <td><button class="mgmt-edit-btn" onclick="openEditStaffModal('${s.id}')">EDIT</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openEditStaffModal(staffId) {
  const s = allStaffForMgmt.find(x => x.id === staffId);
  if (!s) return;
  document.getElementById('editStaffId').value = s.id;
  document.getElementById('editStaffName').textContent = s.first_name + ' ' + (s.last_name || '');
  document.getElementById('editStaffPin').value = s.pos_pin || '';
  document.getElementById('editStaffRole').value = s.pos_role || '';
  openModal('editStaffModal');
}

async function saveStaffPin() {
  const id = document.getElementById('editStaffId').value;
  const pin = document.getElementById('editStaffPin').value.trim();
  const role = document.getElementById('editStaffRole').value;

  if (pin && !/^\d{4}$/.test(pin)) {
    showToast('PIN must be exactly 4 digits');
    return;
  }

  // Check for duplicate PINs
  if (pin) {
    const { data: existing } = await sb
      .from('staff')
      .select('id, first_name')
      .eq('pos_pin', pin)
      .eq('active', true)
      .neq('id', id);
    if (existing && existing.length > 0) {
      showToast('PIN already used by ' + existing[0].first_name);
      return;
    }
  }

  const { error } = await sb.from('staff').update({
    pos_pin: pin || null,
    pos_role: role || null,
  }).eq('id', id);

  if (error) { showToast('Save failed: ' + error.message); return; }

  closeModal('editStaffModal');
  await loadStaff(); // refresh terminal staff list
  await renderMgmtStaff();
  showToast('Staff updated');
}
