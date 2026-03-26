/* RIDDIM POS — Payment Flow */
'use strict';

// ═══════════════════════════════════════════
// PAYMENT
// ═══════════════════════════════════════════

let selectedPayMethod = 'card';
let selectedTip = 0;

function openPayment() {
  const tab = getActiveTab();
  if (!tab) return;

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
  const grand = base + tip;
  document.getElementById('payAmountValue').textContent = '$' + grand.toFixed(2);
}

function submitPayment() {
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
  showReceipt(tab);
  renderTabs();
  renderCart();

  // Persist to local server
  if (typeof serverPayOrder === 'function') {
    const total = tabTotal(tab);
    serverPayOrder(tab, selectedPayMethod, total, tab.tipAmount || 0);
  }
}
