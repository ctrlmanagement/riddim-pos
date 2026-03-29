/* RIDDIM POS — Edit Check */
'use strict';

// ═══════════════════════════════════════════
// EDIT CHECK — Comp, Discount, Service Charge, Tab Name
// ═══════════════════════════════════════════

function openEditCheck() {
  const tab = getActiveTab();
  if (!tab) return;
  document.getElementById('ecPanel').innerHTML = '';
  openModal('editCheckModal');
}

// Edit Tab Name
function ecEditTabName() {
  const tab = getActiveTab();
  if (!tab) return;
  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="form-row">
        <label class="form-label">TAB NAME</label>
        <input type="text" id="ecTabNameInput" class="form-input" value="${tab.name}" placeholder="Tab name">
      </div>
      <div class="form-actions">
        <button class="mgmt-action-btn" onclick="ecSaveTabName()">SAVE</button>
      </div>
    </div>`;
  setTimeout(() => {
    const inp = document.getElementById('ecTabNameInput');
    inp.focus();
    inp.select();
  }, 100);
}

function ecSaveTabName() {
  const tab = getActiveTab();
  if (!tab) return;
  const name = document.getElementById('ecTabNameInput').value.trim();
  if (!name) { showToast('Name cannot be empty'); return; }
  tab.name = name;
  closeModal('editCheckModal');
  renderTabs();
  renderCart();
  showToast('Tab renamed');
}

// Comp Item
function ecComp() {
  if (!hasPermission('order.comp')) {
    showToast('No permission to comp items', 'error');
    return;
  }
  const tab = getActiveTab();
  if (!tab) return;

  const compableLines = tab.lines.filter(l => !l.voided && !l.comped);
  if (compableLines.length === 0) {
    document.getElementById('ecPanel').innerHTML = '<div class="ec-empty">No items to comp</div>';
    return;
  }

  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">SELECT ITEM TO COMP</div>
      ${compableLines.map(l => `
        <div class="ec-line-row" onclick="ecSelectCompItem('${l.id}')">
          <span>${l.qty}x ${l.name}</span>
          <span>$${(l.price * l.qty).toFixed(2)}</span>
        </div>
      `).join('')}
    </div>`;
}

let pendingCompLineId = null;

function ecSelectCompItem(lineId) {
  pendingCompLineId = lineId;
  const tab = getActiveTab();
  const line = tab ? tab.lines.find(l => l.id === lineId) : null;
  const name = line ? line.name : '';

  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">COMP REASON — ${name}</div>
      <select id="compReasonSelect" class="form-input" style="margin-bottom:8px">
        <option value="">-- Select Reason --</option>
        <option value="VIP / Owner Guest">VIP / Owner Guest</option>
        <option value="Manager Discretion">Manager Discretion</option>
        <option value="Quality Issue">Quality Issue</option>
        <option value="Wrong Item Made">Wrong Item Made</option>
        <option value="Promo / Event">Promo / Event</option>
        <option value="Staff Meal">Staff Meal</option>
        <option value="Other">Other</option>
      </select>
      <input type="text" id="compReasonNote" class="form-input" placeholder="Note (optional)">
      <div class="form-actions" style="margin-top:8px">
        <button class="mgmt-action-btn" onclick="ecComp()" style="background:var(--surface);color:var(--ivory-dim);border-color:var(--surface-active)">BACK</button>
        <button class="mgmt-action-btn" onclick="ecDoComp()">COMP</button>
      </div>
    </div>`;
}

function ecDoComp() {
  const tab = getActiveTab();
  if (!tab || !pendingCompLineId) return;
  const line = tab.lines.find(l => l.id === pendingCompLineId);
  if (!line) return;

  const reason = document.getElementById('compReasonSelect').value;
  if (!reason) { showToast('Select a comp reason'); return; }
  const note = document.getElementById('compReasonNote').value.trim();

  line.comped = true;
  line.compedBy = currentUser.id;
  line.compedAt = new Date();
  line.compReason = note ? reason + ' — ' + note : reason;

  pendingCompLineId = null;
  closeModal('editCheckModal');
  renderCart();
  renderTabs();
  showToast(line.name + ' comped — ' + reason);

  // Persist to local server
  if (typeof serverCompLine === 'function') {
    const tab = getActiveTab();
    if (tab) serverCompLine(tab, line, line.compReason);
  }
}

// Discount
function ecDiscount() {
  if (!hasPermission('order.discount')) {
    showToast('No permission to apply discount', 'error');
    return;
  }
  const tab = getActiveTab();
  if (!tab) return;

  const maxPct = (CONFIG.max_discount_pct * 100).toFixed(0);
  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">APPLY DISCOUNT</div>
      <div class="ec-discount-btns">
        <button class="ec-disc-btn" onclick="ecApplyDiscount(0.10)">10%</button>
        <button class="ec-disc-btn" onclick="ecApplyDiscount(0.15)">15%</button>
        <button class="ec-disc-btn" onclick="ecApplyDiscount(0.20)">20%</button>
        <button class="ec-disc-btn" onclick="ecApplyDiscount(0.25)">25%</button>
        <button class="ec-disc-btn" onclick="ecApplyDiscount(0.50)">50%</button>
        <button class="ec-disc-btn" onclick="ecApplyDiscount(1.00)">100%</button>
      </div>
      <div class="form-row" style="margin-top:12px">
        <label class="form-label">CUSTOM %</label>
        <input type="number" id="ecDiscountPct" class="form-input" min="1" max="${maxPct}" placeholder="Enter %" style="width:100px">
        <button class="mgmt-action-btn" onclick="ecApplyDiscount(parseFloat(document.getElementById('ecDiscountPct').value)/100)" style="margin-left:8px">APPLY</button>
      </div>
      <div class="form-row">
        <label class="form-label">FLAT $ OFF</label>
        <input type="number" id="ecDiscountFlat" class="form-input" min="0" step="0.01" placeholder="$0.00" style="width:100px">
        <button class="mgmt-action-btn" onclick="ecApplyFlatDiscount()" style="margin-left:8px">APPLY</button>
      </div>
      ${tab.discount ? '<div class="ec-current">Current discount: ' + (tab.discountPct ? (tab.discountPct * 100).toFixed(0) + '%' : '$' + tab.discountFlat.toFixed(2)) + ' <button class="ec-remove-btn" onclick="ecRemoveDiscount()">REMOVE</button></div>' : ''}
    </div>`;
}

function ecApplyDiscount(pct) {
  if (!pct || isNaN(pct) || pct <= 0) { showToast('Invalid discount'); return; }
  if (pct > CONFIG.max_discount_pct) {
    showToast('Max discount is ' + (CONFIG.max_discount_pct * 100).toFixed(0) + '%');
    return;
  }
  const tab = getActiveTab();
  if (!tab) return;

  tab.discount = true;
  tab.discountPct = pct;
  tab.discountFlat = 0;
  tab.discountBy = currentUser.id;

  closeModal('editCheckModal');
  renderCart();
  renderTabs();
  showToast((pct * 100).toFixed(0) + '% discount applied');

  // Audit log
  if (typeof serverAuditLog === 'function') {
    serverAuditLog('discount', {
      order_id: tab.serverId, tab_name: tab.name, station_code: STATION.code,
      discount_pct: pct, amount: (tabSubtotal(tab) * pct).toFixed(2),
    });
  }
}

function ecApplyFlatDiscount() {
  const amount = parseFloat(document.getElementById('ecDiscountFlat').value);
  if (!amount || isNaN(amount) || amount <= 0) { showToast('Invalid amount'); return; }

  const tab = getActiveTab();
  if (!tab) return;

  const sub = tabSubtotal(tab);
  if (amount > sub) { showToast('Discount exceeds subtotal'); return; }

  tab.discount = true;
  tab.discountPct = 0;
  tab.discountFlat = amount;
  tab.discountBy = currentUser.id;

  closeModal('editCheckModal');
  renderCart();
  renderTabs();
  showToast('$' + amount.toFixed(2) + ' discount applied');

  // Audit log
  if (typeof serverAuditLog === 'function') {
    serverAuditLog('discount', {
      order_id: tab.serverId, tab_name: tab.name, station_code: STATION.code,
      discount_flat: amount, amount: amount.toFixed(2),
    });
  }
}

function ecRemoveDiscount() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.discount = false;
  tab.discountPct = 0;
  tab.discountFlat = 0;
  tab.discountBy = null;

  closeModal('editCheckModal');
  renderCart();
  renderTabs();
  showToast('Discount removed');
}

// Service Charge
function ecGratuity() {
  const tab = getActiveTab();
  if (!tab) return;

  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">SERVICE CHARGE</div>
      <div style="font-size:11px;color:var(--ash);margin-bottom:8px;">Split: 15% → Tips, 5% → Alt Fees</div>
      <div class="ec-discount-btns">
        <button class="ec-disc-btn ${tab.autoGrat === 0.18 ? 'selected' : ''}" onclick="ecApplyGrat(0.18)">18%</button>
        <button class="ec-disc-btn ${tab.autoGrat === 0.20 ? 'selected' : ''}" onclick="ecApplyGrat(0.20)">20%</button>
        <button class="ec-disc-btn ${tab.autoGrat === 0.22 ? 'selected' : ''}" onclick="ecApplyGrat(0.22)">22%</button>
        <button class="ec-disc-btn ${tab.autoGrat === 0.25 ? 'selected' : ''}" onclick="ecApplyGrat(0.25)">25%</button>
      </div>
      ${tab.autoGrat ? '<div class="ec-current">Service charge: ' + (tab.autoGrat * 100).toFixed(0) + '% <button class="ec-remove-btn" onclick="ecRemoveGrat()">REMOVE</button></div>' : ''}
    </div>`;
}

function ecApplyGrat(pct) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.autoGrat = pct;

  closeModal('editCheckModal');
  renderCart();
  showToast('Service charge ' + (pct * 100).toFixed(0) + '% applied');
}

function ecRemoveGrat() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.autoGrat = 0;

  closeModal('editCheckModal');
  renderCart();
  showToast('Service charge removed');
}

// ═══════════════════════════════════════════
// PRICE OVERRIDE (one-time, per line)
// ═══════════════════════════════════════════

function ecPriceOverride() {
  if (!hasPermission('order.modify')) {
    showToast('No permission to modify prices', 'error');
    return;
  }
  const tab = getActiveTab();
  if (!tab) return;

  const editableLines = tab.lines.filter(l => !l.voided && !l.comped);
  if (editableLines.length === 0) {
    document.getElementById('ecPanel').innerHTML = '<div class="ec-empty">No items to edit</div>';
    return;
  }

  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">SELECT ITEM TO CHANGE PRICE</div>
      ${editableLines.map(l => `
        <div class="ec-line-row" onclick="ecSelectPriceItem('${l.id}')">
          <span>${l.qty}x ${l.name}</span>
          <span>$${(l.price * l.qty).toFixed(2)}</span>
        </div>
      `).join('')}
    </div>`;
}

function ecSelectPriceItem(lineId) {
  const tab = getActiveTab();
  const line = tab ? tab.lines.find(l => l.id === lineId) : null;
  if (!line) return;

  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">CHANGE PRICE — ${line.name}</div>
      <div class="form-row" style="margin-bottom:8px">
        <label class="form-label">CURRENT: $${line.price.toFixed(2)}</label>
      </div>
      <div class="form-row">
        <label class="form-label">NEW PRICE</label>
        <input type="number" id="ecNewPrice" class="form-input" min="0" step="0.01" value="${line.price.toFixed(2)}" style="width:120px">
      </div>
      <div class="form-row">
        <label class="form-label">REASON</label>
        <input type="text" id="ecPriceReason" class="form-input" placeholder="Why is the price changing?">
      </div>
      <div class="form-actions" style="margin-top:8px">
        <button class="mgmt-action-btn" onclick="ecPriceOverride()" style="background:var(--surface);color:var(--ivory-dim);border-color:var(--surface-active)">BACK</button>
        <button class="mgmt-action-btn" onclick="ecApplyPriceOverride('${lineId}')">APPLY</button>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('ecNewPrice').focus(), 100);
}

function ecApplyPriceOverride(lineId) {
  const tab = getActiveTab();
  if (!tab) return;
  const line = tab.lines.find(l => l.id === lineId);
  if (!line) return;

  const newPrice = parseFloat(document.getElementById('ecNewPrice').value);
  const reason = document.getElementById('ecPriceReason').value.trim();
  if (isNaN(newPrice) || newPrice < 0) { showToast('Invalid price'); return; }
  if (!reason) { showToast('Reason required for price change'); return; }

  const oldPrice = line.price;
  line.originalPrice = line.originalPrice || oldPrice;
  line.price = newPrice;
  line.priceOverride = true;

  closeModal('editCheckModal');
  renderCart();
  renderTabs();
  showToast(line.name + ': $' + oldPrice.toFixed(2) + ' → $' + newPrice.toFixed(2));

  // Persist to server
  if (typeof serverPriceOverride === 'function') serverPriceOverride(tab, line, newPrice, reason);
}
