/* RIDDIM POS — Cart + Order Lines + Void */
'use strict';

// ═══════════════════════════════════════════
// CART / ORDER LINES
// ═══════════════════════════════════════════

function addToCart(menuItemId) {
  let tab = getActiveTab();
  if (!tab) {
    tab = createTab();
  }

  const item = MENU_ITEMS.find(i => i.id === menuItemId);
  if (!item) return;

  // Get current seat assignment
  const seat = typeof getCurrentSeat === 'function' ? getCurrentSeat() : null;

  // Check if same unsent item exists on same seat — increment qty
  const existing = tab.lines.find(l =>
    l.menuItemId === menuItemId && l.status === 'pending' && !l.voided && l.seat === seat
  );

  if (existing) {
    existing.qty += 1;
  } else {
    tab.lines.push({
      id: 'line-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
      seat: seat,
      status: 'pending',
      voided: false,
      comped: false,
      invProductId: item.invProductId || null,
      addedAt: new Date(),
      addedBy: currentUser.id,
    });
  }

  renderCart();
  renderTabs();
}

function removeLine(lineId) {
  const tab = getActiveTab();
  if (!tab) return;
  const line = tab.lines.find(l => l.id === lineId);
  if (!line) return;

  if (line.status === 'pending') {
    tab.lines = tab.lines.filter(l => l.id !== lineId);
    renderCart();
    renderTabs();
  } else {
    // Already sent — needs void with reason
    if (CONFIG.require_manager_void && currentUser.role !== 'manager' && currentUser.role !== 'owner') {
      showToast('Manager PIN required to void sent items');
      return;
    }
    openVoidReasonModal('line', lineId);
  }
}

function openVoidReasonModal(type, id) {
  document.getElementById('voidReasonType').value = type;
  document.getElementById('voidReasonTargetId').value = id;
  document.getElementById('voidReasonSelect').value = '';
  document.getElementById('voidReasonNote').value = '';
  openModal('voidReasonModal');
}

function submitVoidReason() {
  const type = document.getElementById('voidReasonType').value;
  const id = document.getElementById('voidReasonTargetId').value;
  const reason = document.getElementById('voidReasonSelect').value;
  const note = document.getElementById('voidReasonNote').value.trim();

  if (!reason) { showToast('Select a void reason'); return; }

  const fullReason = note ? reason + ' — ' + note : reason;

  if (type === 'line') {
    const tab = getActiveTab();
    if (!tab) return;
    const line = tab.lines.find(l => l.id === id);
    if (!line) return;
    line.voided = true;
    line.status = 'voided';
    line.voidReason = fullReason;
    line.voidedBy = currentUser.id;
    line.voidedAt = new Date();
    closeModal('voidReasonModal');
    renderCart();
    renderTabs();
    showToast(line.name + ' voided');
  } else if (type === 'tab') {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    tab.status = 'voided';
    tab.voidedAt = new Date();
    tab.voidedBy = currentUser.id;
    tab.voidReason = fullReason;
    tab.lines.forEach(l => {
      l.voided = true;
      l.status = 'voided';
      l.voidReason = fullReason;
    });
    activeTabId = null;
    const openTabs = tabs.filter(t => t.status === 'open' || t.status === 'sent');
    if (openTabs.length > 0) activeTabId = openTabs[0].id;
    closeModal('voidReasonModal');
    renderTabs();
    renderCart();
    showToast(tab.name + ' voided — ' + reason);
  }
}

// ═══════════════════════════════════════════
// TAB TOTALS
// ═══════════════════════════════════════════

function tabSubtotal(tab) {
  return tab.lines
    .filter(l => !l.voided && !l.comped)
    .reduce((sum, l) => sum + (l.price * l.qty), 0);
}

function tabDiscountAmount(tab) {
  if (!tab.discount) return 0;
  const sub = tabSubtotal(tab);
  if (tab.discountPct) return sub * tab.discountPct;
  if (tab.discountFlat) return Math.min(tab.discountFlat, sub);
  return 0;
}

function tabTax(tab) {
  return (tabSubtotal(tab) - tabDiscountAmount(tab)) * CONFIG.tax_rate;
}

function tabTotal(tab) {
  const sub = tabSubtotal(tab);
  const disc = tabDiscountAmount(tab);
  const afterDiscount = sub - disc;
  const tax = afterDiscount * CONFIG.tax_rate;
  const grat = tab.autoGrat ? afterDiscount * tab.autoGrat : 0;
  return afterDiscount + tax + grat;
}

// ═══════════════════════════════════════════
// RENDER CART
// ═══════════════════════════════════════════

function renderCart() {
  const tab = getActiveTab();
  const itemsEl = document.getElementById('cartItems');
  const headerEl = document.getElementById('cartTabName');
  const typeEl = document.getElementById('cartTabType');
  const totalsEl = document.getElementById('cartTotals');
  const fireBtn = document.getElementById('btnFire');
  const payBtn = document.getElementById('btnPay');
  const holdBtn = document.getElementById('btnHold');
  const voidBtn = document.getElementById('btnVoid');
  const editBtn = document.getElementById('btnEditCheck');

  if (!tab) {
    headerEl.textContent = 'NO TAB';
    typeEl.textContent = '';
    itemsEl.innerHTML = '<div class="cart-empty">Tap + to open a tab</div>';
    totalsEl.innerHTML = '';
    fireBtn.disabled = true;
    payBtn.disabled = true;
    holdBtn.disabled = true;
    voidBtn.disabled = true;
    if (editBtn) editBtn.style.display = 'none';
    return;
  }

  headerEl.textContent = tab.name;
  typeEl.textContent = tab.type.toUpperCase() + ' TAB';
  if (editBtn) editBtn.style.display = '';

  // Bottle service: guest count + min spend bar (injected above cart items)
  let cartExtras = '';
  if (typeof renderGuestCountBar === 'function') cartExtras += renderGuestCountBar(tab);
  if (typeof renderMinSpendBar === 'function') cartExtras += renderMinSpendBar(tab);

  // Group lines by seat if any lines have seats
  const hasSeats = tab.lines.some(l => l.seat);

  // Lines
  if (tab.lines.length === 0) {
    itemsEl.innerHTML = cartExtras + '<div class="cart-empty">Add items from the menu</div>';
  } else {
    let html = '';
    if (hasSeats) {
      // Group by seat
      const seatGroups = {};
      const noSeat = [];
      tab.lines.forEach(l => {
        if (l.seat) {
          if (!seatGroups[l.seat]) seatGroups[l.seat] = [];
          seatGroups[l.seat].push(l);
        } else {
          noSeat.push(l);
        }
      });

      // Render no-seat items first
      if (noSeat.length > 0) {
        html += noSeat.map(l => renderCartLine(l)).join('');
      }
      // Then each seat group
      const seats = Object.keys(seatGroups).sort((a, b) => a - b);
      seats.forEach(s => {
        html += `<div class="cart-seat-divider">SEAT ${s}</div>`;
        html += seatGroups[s].map(l => renderCartLine(l)).join('');
      });
    } else {
      html = tab.lines.map(l => renderCartLine(l)).join('');
    }
    itemsEl.innerHTML = cartExtras + html;
  }

  // Totals
  const sub = tabSubtotal(tab);
  const discountAmt = tabDiscountAmount(tab);
  const afterDiscount = sub - discountAmt;
  const tax = afterDiscount * CONFIG.tax_rate;
  const gratAmt = tab.autoGrat ? afterDiscount * tab.autoGrat : 0;
  const total = afterDiscount + tax + gratAmt;
  const taxPct = (CONFIG.tax_rate * 100).toFixed(1);

  let totalsHtml = `<div class="cart-total-row"><span>Subtotal</span><span>$${sub.toFixed(2)}</span></div>`;
  if (discountAmt > 0) {
    const discLabel = tab.discountPct ? (tab.discountPct * 100).toFixed(0) + '% off' : '$' + tab.discountFlat.toFixed(2) + ' off';
    totalsHtml += `<div class="cart-total-row discount"><span>Discount (${discLabel})</span><span>-$${discountAmt.toFixed(2)}</span></div>`;
  }
  totalsHtml += `<div class="cart-total-row"><span>Tax (${taxPct}%)</span><span>$${tax.toFixed(2)}</span></div>`;
  if (gratAmt > 0) {
    totalsHtml += `<div class="cart-total-row grat"><span>Auto-Grat (${(tab.autoGrat * 100).toFixed(0)}%)</span><span>$${gratAmt.toFixed(2)}</span></div>`;
  }
  totalsHtml += `<div class="cart-total-row grand"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>`;
  totalsEl.innerHTML = totalsHtml;

  // Button states
  const hasPending = tab.lines.some(l => l.status === 'pending' && !l.voided);
  const hasLines = tab.lines.some(l => !l.voided);
  fireBtn.disabled = !hasPending;
  payBtn.disabled = !hasLines;
  holdBtn.disabled = !hasLines;
  voidBtn.disabled = false;
}

function renderCartLine(l) {
  const classes = ['cart-line'];
  if (l.voided) classes.push('voided');
  if (l.comped) classes.push('comped');
  if (l.status === 'sent' || l.status === 'preparing' || l.status === 'ready') classes.push('sent');

  return `<div class="${classes.join(' ')}" onclick="removeLine('${l.id}')">
    <span class="cart-line-qty">${l.qty}x</span>
    <span class="cart-line-name">
      ${l.name}
      ${l.seat ? '<span class="seat-badge">S' + l.seat + '</span>' : ''}
      ${l.status !== 'pending' && !l.voided ? '<span class="sent-badge">' + l.status.toUpperCase() + '</span>' : ''}
      ${l.comped ? '<span class="sent-badge" style="background:var(--orange)">COMP</span>' : ''}
    </span>
    <span class="cart-line-price">${l.voided || l.comped ? '—' : '$' + (l.price * l.qty).toFixed(2)}</span>
  </div>`;
}

// ═══════════════════════════════════════════
// FIRE (send to KDS)
// ═══════════════════════════════════════════

function fireOrder() {
  const tab = getActiveTab();
  if (!tab) return;

  tab.lines.forEach(l => {
    if (l.status === 'pending' && !l.voided) {
      l.status = 'sent';
      l.sentAt = new Date();
    }
  });

  tab.status = 'sent';
  renderCart();
  renderTabs();

  // Visual feedback
  const btn = document.getElementById('btnFire');
  btn.textContent = 'SENT';
  btn.style.background = '#1E8449';
  setTimeout(() => {
    btn.textContent = 'FIRE';
    btn.style.background = '';
  }, 1200);
}

// ═══════════════════════════════════════════
// HOLD / VOID
// ═══════════════════════════════════════════

function holdTab() {
  const tab = getActiveTab();
  if (!tab) return;

  activeTabId = null;
  const openTabs = tabs.filter(t => (t.status === 'open' || t.status === 'sent') && t.id !== tab.id);
  if (openTabs.length > 0) {
    activeTabId = openTabs[0].id;
  }

  renderTabs();
  renderCart();
}

function voidTab() {
  const tab = getActiveTab();
  if (!tab) return;

  if (CONFIG.require_manager_void && currentUser.role !== 'manager' && currentUser.role !== 'owner') {
    showToast('Manager PIN required to void tab');
    return;
  }

  openVoidReasonModal('tab', tab.id);
}
