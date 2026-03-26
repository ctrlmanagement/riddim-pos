/* RIDDIM POS — Payment Flow
   S79: Min spend enforcement, table session close, booking close */

'use strict';

// ═══════════════════════════════════════════
// PAYMENT
// ═══════════════════════════════════════════

let selectedPayMethod = 'card';
let selectedTip = 0;

function openPayment() {
  const tab = getActiveTab();
  if (!tab) return;

  // Min spend check — warn if under minimum
  const minSpend = getTabMinSpend(tab);
  const spent = typeof tabSubtotal === 'function' ? tabSubtotal(tab) : 0;
  const minWarning = document.getElementById('payMinSpendWarning');
  if (minWarning) {
    if (minSpend > 0 && spent < minSpend) {
      const shortfall = minSpend - spent;
      minWarning.innerHTML = `<div class="pay-min-warn">MINIMUM NOT MET — $${shortfall.toFixed(2)} short of $${minSpend.toFixed(0)} minimum</div>`;
      minWarning.style.display = '';
    } else {
      minWarning.innerHTML = '';
      minWarning.style.display = 'none';
    }
  }

  // Deposit credit display
  const depositInfo = document.getElementById('payDepositInfo');
  if (depositInfo) {
    if (tab.depositAmount && tab.depositAmount > 0) {
      depositInfo.innerHTML = `<div class="pay-deposit-info">DEPOSIT APPLIED: -$${tab.depositAmount.toFixed(2)}</div>`;
      depositInfo.style.display = '';
    } else {
      depositInfo.innerHTML = '';
      depositInfo.style.display = 'none';
    }
  }

  // Member info
  const memberInfo = document.getElementById('payMemberInfo');
  if (memberInfo) {
    if (tab.memberId && tab.memberName) {
      const tier = typeof getMemberTier === 'function' ? getMemberTier(tab.memberPoints || 0) : { name: 'Silver' };
      memberInfo.innerHTML = `<div class="pay-member-info">${tab.memberName} — ${tier.name}</div>`;
      memberInfo.style.display = '';
    } else {
      memberInfo.innerHTML = '';
      memberInfo.style.display = 'none';
    }
  }

  selectedPayMethod = 'card';
  // If auto-grat is set, skip manual tip
  selectedTip = tab.autoGrat ? 0 : CONFIG.default_tip_pct;
  updatePayMethodButtons();
  updateTipButtons();
  openModal('paymentModal');
}

function selectPayMethod(method) {
  selectedPayMethod = method;
  updatePayMethodButtons();
}

function updatePayMethodButtons() {
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.method === selectedPayMethod);
  });
}

function selectTip(pct) {
  selectedTip = pct;
  updateTipButtons();
}

function updateTipButtons() {
  document.querySelectorAll('.tip-btn').forEach(btn => {
    btn.classList.toggle('selected', parseFloat(btn.dataset.tip) === selectedTip);
  });

  const tab = getActiveTab();
  if (!tab) return;
  const base = tabTotal(tab); // already includes discount, tax, auto-grat
  const sub = tabSubtotal(tab) - tabDiscountAmount(tab);
  const tip = tab.autoGrat ? 0 : sub * selectedTip; // no manual tip if auto-grat

  // Apply deposit credit if present
  const deposit = tab.depositAmount || 0;
  const grand = Math.max(0, base + tip - deposit);
  document.getElementById('payAmountValue').textContent = '$' + grand.toFixed(2);

  // Show deposit line if applicable
  const depositLine = document.getElementById('payDepositLine');
  if (depositLine) {
    if (deposit > 0) {
      depositLine.textContent = 'Deposit: -$' + deposit.toFixed(2);
      depositLine.style.display = '';
    } else {
      depositLine.style.display = 'none';
    }
  }
}

async function submitPayment() {
  const tab = getActiveTab();
  if (!tab) return;

  tab.status = 'paid';
  tab.paidAt = new Date();
  tab.payMethod = selectedPayMethod;
  const tipBase = tabSubtotal(tab) - tabDiscountAmount(tab);
  tab.tipPct = tab.autoGrat || selectedTip;
  tab.tipAmount = tab.autoGrat ? tipBase * tab.autoGrat : tipBase * selectedTip;

  // Mark all lines served
  tab.lines.forEach(l => {
    if (!l.voided && l.status !== 'voided') {
      l.status = 'served';
    }
  });

  // Close tab after payment recorded
  tab.status = 'closed';
  tab.closedAt = new Date();

  // Clear from active
  activeTabId = null;
  const openTabs = tabs.filter(t => t.status === 'open' || t.status === 'sent');
  if (openTabs.length > 0) {
    activeTabId = openTabs[0].id;
  }

  closeModal('paymentModal');
  renderTabs();
  renderCart();

  // Persist to local server — await so sale_num is available for receipt
  if (typeof serverPayOrder === 'function') {
    const total = tabTotal(tab);
    await serverPayOrder(tab, selectedPayMethod, total, tab.tipAmount || 0);
  }

  // ── RIDDIM INTEGRATION: Close table session + booking ──
  if (tab.sessionId && typeof closeTableSession === 'function') {
    closeTableSession(tab); // fire-and-forget
  }
  if (tab.bookingId && typeof closeBooking === 'function') {
    const paymentTotal = tabTotal(tab) + (tab.tipAmount || 0);
    closeBooking(tab.bookingId, paymentTotal); // fire-and-forget
  }

  // Update floor plan if in tables view
  if (typeof updateFloorPlan === 'function') updateFloorPlan();

  showReceipt(tab);
}

// ═══════════════════════════════════════════
// MIN SPEND HELPER
// ═══════════════════════════════════════════

function getTabMinSpend(tab) {
  if (!tab) return 0;

  // First check booking-level min spend (transferred from table_bookings)
  if (tab.minSpendRequired && tab.minSpendRequired > 0) {
    return tab.minSpendRequired;
  }

  // Fall back to table_minimums rules
  if (typeof getMinSpendForTab === 'function') {
    const min = getMinSpendForTab(tab);
    return min ? min.amount : 0;
  }

  return 0;
}
