/* RIDDIM POS — Payment Flow
   S79: Deposit as split payment, min spend enforcement, session close */

'use strict';

// ═══════════════════════════════════════════
// PAYMENT STATE
// ═══════════════════════════════════════════

let selectedPayMethod = 'card';
let selectedTip = 0;

function openPayment() {
  const tab = getActiveTab();
  if (!tab) return;

  const deposit = tab.depositAmount || 0;
  const total = tabTotal(tab);

  // Min spend check — subtotal + tax (no grat)
  const minSpend = getTabMinSpend(tab);
  const spent = typeof tabSubtotal === 'function' ? tabSubtotal(tab) : 0;
  const spentWithTax = spent + (spent * CONFIG.tax_rate);
  const minWarning = document.getElementById('payMinSpendWarning');
  if (minWarning) {
    if (minSpend > 0 && spentWithTax < minSpend) {
      const shortfall = minSpend - spentWithTax;
      minWarning.innerHTML = `<div class="pay-min-warn">MINIMUM NOT MET — $${shortfall.toFixed(2)} short of $${minSpend.toFixed(0)} minimum</div>`;
      minWarning.style.display = '';
    } else {
      minWarning.innerHTML = '';
      minWarning.style.display = 'none';
    }
  }

  // Deposit info — show as split payment
  const depositInfo = document.getElementById('payDepositInfo');
  if (depositInfo) {
    if (deposit > 0) {
      const usedDeposit = Math.min(deposit, total);
      const unused = deposit - usedDeposit;
      let html = `<div class="pay-deposit-info">DEPOSIT: $${deposit.toFixed(2)} — applied $${usedDeposit.toFixed(2)}</div>`;
      if (unused > 0) {
        html += `<div class="pay-deposit-surplus">$${unused.toFixed(2)} unused → OTHER INCOME</div>`;
      }
      depositInfo.innerHTML = html;
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
      const memberDiv = document.createElement('div');
      memberDiv.className = 'pay-member-info';
      memberDiv.textContent = `${tab.memberName} — ${tier.name}`;
      memberInfo.innerHTML = '';
      memberInfo.appendChild(memberDiv);
      memberInfo.style.display = '';
    } else {
      memberInfo.innerHTML = '';
      memberInfo.style.display = 'none';
    }
  }

  // If deposit covers the full tab, default to no additional payment needed
  selectedPayMethod = deposit >= total ? 'deposit' : 'card';
  selectedTip = tab.autoGrat ? 0 : CONFIG.default_tip_pct;

  updatePayMethodButtons();
  updateTipButtons();
  updatePayLabel(tab);
  openModal('paymentModal');
}

function selectPayMethod(method) {
  selectedPayMethod = method;
  updatePayMethodButtons();
  updateTipButtons();
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

  const base = tabTotal(tab);
  const sub = tabSubtotal(tab) - tabDiscountAmount(tab);
  const tip = tab.autoGrat ? 0 : sub * selectedTip;
  const totalWithTip = base + tip;

  const deposit = tab.depositAmount || 0;
  const balanceDue = Math.max(0, totalWithTip - deposit);

  document.getElementById('payAmountValue').textContent = '$' + balanceDue.toFixed(2);

  // Show deposit breakdown
  const depositLine = document.getElementById('payDepositLine');
  if (depositLine) {
    if (deposit > 0) {
      const usedDeposit = Math.min(deposit, totalWithTip);
      depositLine.innerHTML = `<span style="color:#27AE60;">Deposit: -$${usedDeposit.toFixed(2)}</span>`;
      depositLine.style.display = '';
    } else {
      depositLine.style.display = 'none';
    }
  }

  updatePayLabel(tab);
}

// Update the label above TOTAL DUE based on whether deposit covers everything
function updatePayLabel(tab) {
  const label = document.querySelector('.pay-amount-label');
  if (!label) return;

  const deposit = tab ? (tab.depositAmount || 0) : 0;
  const base = tab ? tabTotal(tab) : 0;
  const sub = tab ? tabSubtotal(tab) - tabDiscountAmount(tab) : 0;
  const tip = tab && tab.autoGrat ? 0 : sub * selectedTip;
  const totalWithTip = base + tip;

  if (deposit > 0 && deposit >= totalWithTip) {
    label.textContent = 'COVERED BY DEPOSIT';
  } else if (deposit > 0) {
    label.textContent = 'BALANCE DUE (AFTER DEPOSIT)';
  } else {
    label.textContent = 'TOTAL DUE';
  }

  // Hide payment methods if deposit covers everything
  const methodsEl = document.querySelector('.pay-methods');
  if (methodsEl) {
    methodsEl.style.display = (deposit > 0 && deposit >= totalWithTip) ? 'none' : '';
  }
}

// ═══════════════════════════════════════════
// SUBMIT PAYMENT — handles deposit split
// ═══════════════════════════════════════════

let _paymentSubmitting = false;

async function submitPayment() {
  if (_paymentSubmitting) return;
  const tab = getActiveTab();
  if (!tab) return;

  _paymentSubmitting = true;
  const payBtn = document.querySelector('#paymentModal .pay-submit');
  if (payBtn) payBtn.disabled = true;

  try {
    const tipBase = tabSubtotal(tab) - tabDiscountAmount(tab);
    tab.tipPct = tab.autoGrat || selectedTip;
    tab.tipAmount = tab.autoGrat ? tipBase * tab.autoGrat : tipBase * selectedTip;
    if (isNaN(tab.tipAmount)) tab.tipAmount = 0;

    const totalWithTip = tabTotal(tab) + (tab.autoGrat ? 0 : tab.tipAmount);
    const deposit = tab.depositAmount || 0;
    const usedDeposit = Math.min(deposit, totalWithTip);
    const unusedDeposit = Math.max(0, deposit - totalWithTip);
    const balanceDue = Math.max(0, totalWithTip - deposit);

    // Store deposit accounting on tab for receipt/reporting
    tab.depositUsed = usedDeposit;
    tab.depositUnused = unusedDeposit;
    tab.balanceDue = balanceDue;

    // Payment method for the balance (or 'deposit' if fully covered)
    tab.payMethod = balanceDue > 0 ? selectedPayMethod : 'deposit';

    tab.paidAt = new Date();

    // Mark all lines served
    tab.lines.forEach(l => {
      if (!l.voided && l.status !== 'voided') {
        l.status = 'served';
      }
    });

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

    // ── Persist to local server ──
    let paymentFailed = false;

    // Payment #1: Deposit (if any)
    if (usedDeposit > 0 && typeof serverPayOrder === 'function') {
      const depResult = await serverPost(`/api/orders/${tab.serverId}/pay`, {
        method: 'deposit',
        amount: usedDeposit,
        tip_amount: 0,
        processed_by: currentUser.id,
      });
      if (depResult && depResult.error) paymentFailed = true;
    }

    // Payment #2: Balance (card/cash/comp — if any remaining)
    // balanceDue includes tip — split it out so amount = sale only, tip_amount = tip only
    const tipForPayment = tab.tipAmount || 0;
    const saleAmount = Math.max(0, balanceDue - tipForPayment);
    if (balanceDue > 0 && typeof serverPayOrder === 'function') {
      const payResult = await serverPayOrder(tab, selectedPayMethod, saleAmount, tipForPayment);
      if (payResult && payResult.error) paymentFailed = true;
      if (!payResult && serverConnected) paymentFailed = true;
    } else if (tab.serverId) {
      // $0 balance — deposit covered everything, or fully comped, or empty tab
      // Always create a payment record so order moves to 'paid' and gets a sale_num
      const zResult = await serverPost(`/api/orders/${tab.serverId}/pay`, {
        method: usedDeposit > 0 ? 'deposit' : (selectedPayMethod || 'comp'),
        amount: 0,
        tip_amount: tab.tipAmount || 0,
        processed_by: currentUser.id,
      });
      if (zResult && zResult.error) paymentFailed = true;
    }

    if (paymentFailed) {
      showToast('WARNING: Payment may not have saved to server — verify before next close', 'error');
    }

    // ── Record unused deposit as OTHER INCOME audit entry ──
    if (unusedDeposit > 0 && tab.serverId && typeof serverAuditLog === 'function') {
      serverAuditLog('deposit_surplus', {
        order_id: tab.serverId,
        booking_id: tab.bookingId,
        deposit_total: deposit,
        deposit_used: usedDeposit,
        deposit_unused: unusedDeposit,
        guest_name: tab.guestName || null,
      }, 'Unused deposit → OTHER INCOME');
    }

    // ── RIDDIM INTEGRATION: Close table session + booking ──
    if (tab.sessionId && typeof closeTableSession === 'function') {
      closeTableSession(tab);
    }
    if (tab.bookingId && typeof closeBooking === 'function') {
      closeBooking(tab.bookingId, totalWithTip);
    }

    if (typeof updateFloorPlan === 'function') updateFloorPlan();

    showReceipt(tab);
  } finally {
    _paymentSubmitting = false;
    if (payBtn) payBtn.disabled = false;
  }
}

// ═══════════════════════════════════════════
// MIN SPEND HELPER
// ═══════════════════════════════════════════

function getTabMinSpend(tab) {
  if (!tab) return 0;

  if (tab.minSpendRequired && tab.minSpendRequired > 0) {
    return tab.minSpendRequired;
  }

  if (typeof getMinSpendForTab === 'function') {
    const min = getMinSpendForTab(tab);
    return min ? min.amount : 0;
  }

  return 0;
}
