/* RIDDIM POS — Cart + Order Lines + Void */
'use strict';

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════
// CART / ORDER LINES
// ═══════════════════════════════════════════

async function addToCart(menuItemId) {
  let tab = getActiveTab();
  if (!tab) {
    // If a table is pending, materialize it now
    if (typeof pendingTableNum !== 'undefined' && pendingTableNum) {
      tab = await materializePendingTable();
    }
    if (!tab) {
      tab = await createTab();
    }
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
    const newLine = {
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
    };
    tab.lines.push(newLine);

    // Persist to local server
    if (typeof serverAddLines === 'function') serverAddLines(tab, [newLine]);
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
    // Already sent — needs void permission
    if (!hasPermission('order.void_line')) {
      showToast('No permission to void sent items', 'error');
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
    showToast(line.name + ' voided', 'warning');

    // Persist to local server
    if (typeof serverVoidLine === 'function') serverVoidLine(tab, line, fullReason);
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
    showToast(tab.name + ' voided — ' + reason, 'warning');

    // Persist to local server
    if (typeof serverVoidOrder === 'function') serverVoidOrder(tab, fullReason);

    // Clean up table session if tab was linked to a table
    if (tab.sessionId && typeof closeTableSession === 'function') {
      closeTableSession(tab);
    }
    if (typeof updateFloorPlan === 'function') updateFloorPlan();
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
    const pending = typeof pendingTableNum !== 'undefined' && pendingTableNum;
    headerEl.textContent = pending ? 'TABLE ' + pendingTableNum : 'NO TAB';
    typeEl.textContent = pending ? 'TAP AN ITEM TO START' : '';
    itemsEl.innerHTML = pending
      ? '<div class="cart-empty">Add items from the menu to open this table</div>'
      : '<div class="cart-empty">Tap + to open a tab</div>';
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

  // Booking info block — shows reservation context for staff
  let cartExtras = '';
  if (tab.bookingId || tab.depositAmount || tab.eventName) {
    cartExtras += '<div style="padding:8px 10px;background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.15);border-radius:6px;margin-bottom:6px;font-size:12px;">';
    if (tab.eventName) cartExtras += `<div style="font-family:\'Bebas Neue\',sans-serif;font-size:14px;letter-spacing:1px;color:#D4A843;margin-bottom:2px;">${escHtml(tab.eventName)}</div>`;
    if (tab.guestName) cartExtras += `<div style="color:#F5F0E8;">${escHtml(tab.guestName)}${tab.memberName && tab.memberName !== tab.guestName ? ' — ' + escHtml(tab.memberName) : ''}</div>`;
    if (tab.depositAmount && tab.depositAmount > 0) cartExtras += `<div style="color:#27AE60;font-family:\'Bebas Neue\',sans-serif;letter-spacing:1px;">DEPOSIT: $${tab.depositAmount.toFixed(2)}</div>`;
    cartExtras += '</div>';
  }

  // Member badge + Bottle service: guest count + min spend bar
  if (typeof renderMemberBadge === 'function') cartExtras += renderMemberBadge(tab);
  if (typeof renderGuestCountBar === 'function') cartExtras += renderGuestCountBar(tab);
  if (typeof renderMinSpendBar === 'function') cartExtras += renderMinSpendBar(tab);
  // Booking-level min spend (from reservation) overrides table_minimums
  if (tab.minSpendRequired && tab.minSpendRequired > 0 && typeof renderMinSpendBar === 'function') {
    const spent = tabSubtotal(tab);
    const pct = Math.min((spent / tab.minSpendRequired) * 100, 100);
    const met = spent >= tab.minSpendRequired;
    const fillClass = met ? 'met' : pct >= 75 ? 'close' : 'under';
    // Only render if getMinSpendForTab didn't already cover it
    if (!getMinSpendForTab || !getMinSpendForTab(tab)) {
      cartExtras += `<div class="min-spend-bar booking-min">
        <span class="min-spend-label">BOOKING MIN</span>
        <div class="min-spend-track">
          <div class="min-spend-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        <span class="min-spend-val ${met ? 'met' : ''}">$${spent.toFixed(0)} / $${tab.minSpendRequired.toFixed(0)}</span>
      </div>`;
    }
  }

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
  payBtn.disabled = false; // Always allow PAY — supports $0 close, comps, voids, exact cash
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

let _firePending = false;

function fireOrder() {
  if (_firePending) return;
  const tab = getActiveTab();
  if (!tab) return;

  _firePending = true;

  tab.lines.forEach(l => {
    if (l.status === 'pending' && !l.voided) {
      l.status = 'sent';
      l.sentAt = new Date();
    }
  });

  tab.status = 'sent';
  renderCart();
  renderTabs();

  // Persist to local server
  if (typeof serverFireOrder === 'function') serverFireOrder(tab);

  // Visual feedback
  const btn = document.getElementById('btnFire');
  btn.textContent = 'SENT';
  btn.style.background = '#1E8449';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = 'FIRE';
    btn.style.background = '';
    btn.disabled = false;
    _firePending = false;
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

  // Persist to local server
  if (typeof serverHoldOrder === 'function') serverHoldOrder(tab);
}

function voidTab() {
  const tab = getActiveTab();
  if (!tab) return;

  if (!hasPermission('order.void_tab')) {
    showToast('No permission to void tab', 'error');
    return;
  }

  openVoidReasonModal('tab', tab.id);
}
