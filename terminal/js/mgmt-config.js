/* RIDDIM POS — Management: Stations + Settings */
'use strict';

// ═══════════════════════════════════════════
// STATIONS MANAGEMENT
// ═══════════════════════════════════════════

async function renderMgmtStations() {
  const { data, error } = await sb
    .from('pos_stations')
    .select('*')
    .order('code');

  if (error) { showToast('Failed to load stations'); return; }

  const list = document.getElementById('mgmtStationList');
  list.innerHTML = `
    <table class="mgmt-table">
      <thead>
        <tr><th>CODE</th><th>LABEL</th><th>POS NAME</th><th>ACTIVE</th><th></th></tr>
      </thead>
      <tbody>
        ${(data || []).map(s => `
          <tr>
            <td>${s.code}</td>
            <td>${s.label}</td>
            <td>${s.pos_name || '—'}</td>
            <td>${s.active ? '<span style="color:var(--green)">YES</span>' : '<span style="color:var(--ash)">NO</span>'}</td>
            <td><button class="mgmt-edit-btn" onclick="toggleStation('${s.id}', ${!s.active})">${s.active ? 'DISABLE' : 'ENABLE'}</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function toggleStation(stationId, active) {
  const { error } = await sb.from('pos_stations').update({ active }).eq('id', stationId);
  if (error) { showToast('Failed: ' + error.message); return; }
  await loadStations();
  renderMgmtStations();
  showToast(active ? 'Station enabled' : 'Station disabled');
}

// ═══════════════════════════════════════════
// POS SETTINGS
// ═══════════════════════════════════════════

async function renderMgmtSettings() {
  const { data, error } = await sb.from('pos_config').select('*').limit(1).single();
  if (error || !data) { showToast('Failed to load settings'); return; }

  const el = document.getElementById('mgmtSettings');
  el.innerHTML = `
    <div class="form-row">
      <label class="form-label">TAX RATE (%)</label>
      <input type="number" id="settingTaxRate" class="form-input" step="0.001" value="${(data.tax_rate * 100).toFixed(1)}">
    </div>
    <div class="form-row">
      <label class="form-label">DEFAULT TIP (%)</label>
      <input type="number" id="settingTipPct" class="form-input" step="1" value="${(data.default_tip_pct * 100).toFixed(0)}">
    </div>
    <div class="form-row">
      <label class="form-label">MAX DISCOUNT (%)</label>
      <input type="number" id="settingMaxDiscount" class="form-input" step="1" value="${(data.max_discount_pct * 100).toFixed(0)}">
    </div>
    <div class="form-row">
      <label class="form-label">REQUIRE MANAGER FOR VOID</label>
      <label class="form-toggle"><input type="checkbox" id="settingMgrVoid" ${data.require_manager_void ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="form-row">
      <label class="form-label">REQUIRE MANAGER FOR COMP</label>
      <label class="form-toggle"><input type="checkbox" id="settingMgrComp" ${data.require_manager_comp ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="form-row">
      <label class="form-label">REQUIRE MANAGER FOR DISCOUNT</label>
      <label class="form-toggle"><input type="checkbox" id="settingMgrDiscount" ${data.require_manager_discount ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="form-row">
      <label class="form-label">RECEIPT FOOTER</label>
      <input type="text" id="settingReceipt" class="form-input" value="${data.receipt_footer || ''}">
    </div>
    <div class="form-actions">
      <button class="mgmt-action-btn" onclick="saveSettings()">SAVE SETTINGS</button>
    </div>
  `;
}

async function saveSettings() {
  const row = {
    tax_rate: parseFloat(document.getElementById('settingTaxRate').value) / 100,
    default_tip_pct: parseFloat(document.getElementById('settingTipPct').value) / 100,
    max_discount_pct: parseFloat(document.getElementById('settingMaxDiscount').value) / 100,
    require_manager_void: document.getElementById('settingMgrVoid').checked,
    require_manager_comp: document.getElementById('settingMgrComp').checked,
    require_manager_discount: document.getElementById('settingMgrDiscount').checked,
    receipt_footer: document.getElementById('settingReceipt').value.trim(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from('pos_config').update(row).not('id', 'is', null);
  if (error) { showToast('Save failed: ' + error.message); return; }

  await loadConfig();
  showToast('Settings saved');
}
