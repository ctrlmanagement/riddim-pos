/* RIDDIM POS — Receipt Preview + Print */
'use strict';

// ═══════════════════════════════════════════
// RECEIPT PREVIEW
// ═══════════════════════════════════════════

let _lastReceiptTab = null;

function showReceipt(tab) {
  const el = document.getElementById('receiptBody');
  if (!el) return;

  _lastReceiptTab = tab;

  const now = tab.closedAt || new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Staff name
  const staffMap = {};
  STAFF.forEach(s => staffMap[s.id] = s.name);
  const server = staffMap[tab.createdBy] || 'Staff';

  // Line items
  const lines = tab.lines.filter(l => !l.voided);
  const sub = tabSubtotal(tab);
  const disc = tabDiscountAmount(tab);
  const afterDisc = sub - disc;
  const tax = afterDisc * CONFIG.tax_rate;
  const grat = tab.autoGrat ? afterDisc * tab.autoGrat : 0;
  const tip = tab.tipAmount || 0;
  const total = afterDisc + tax + grat + (tab.autoGrat ? 0 : tip);
  const taxPct = (CONFIG.tax_rate * 100).toFixed(1);

  let html = '';

  // Header
  html += `<div class="rcpt-center rcpt-brand">${CONFIG.venue_name}</div>`;
  html += `<div class="rcpt-center rcpt-sm">${CONFIG.venue_subtitle}</div>`;
  html += `<div class="rcpt-center rcpt-sm">${CONFIG.venue_city}</div>`;
  html += '<hr class="rcpt-divider">';

  // Order / Sale IDs
  const orderNum = tab.orderNum || '—';
  const saleNum = tab.saleNum || '—';
  html += `<div class="rcpt-row"><span>Order #${orderNum}</span><span>Sale ID: ${saleNum}</span></div>`;

  // Meta
  html += `<div class="rcpt-row"><span>${tab.name}</span><span>${tab.payMethod ? tab.payMethod.toUpperCase() : ''}</span></div>`;
  html += `<div class="rcpt-row"><span>Server: ${server}</span><span>${STATION.label}</span></div>`;
  html += `<div class="rcpt-row"><span>${dateStr}</span><span>${timeStr}</span></div>`;
  if (tab.tableNum) html += `<div class="rcpt-row"><span>Table ${tab.tableNum}</span><span>Guests: ${tab.guestCount || 1}</span></div>`;
  html += '<hr class="rcpt-divider">';

  // Items
  lines.forEach(l => {
    const price = l.comped ? '  COMP' : '$' + (l.price * l.qty).toFixed(2);
    const seatTag = l.seat ? ' [S' + l.seat + ']' : '';
    html += `<div class="rcpt-row"><span>${l.qty}x ${l.name}${seatTag}</span><span>${price}</span></div>`;
    if (l.modifiers && l.modifiers.length) {
      html += `<div class="rcpt-row rcpt-sm" style="padding-left:20px;color:var(--ash)"><span>${l.modifiers.join(', ')}</span><span></span></div>`;
    }
  });

  html += '<hr class="rcpt-divider">';

  // Totals
  html += `<div class="rcpt-row"><span>Subtotal</span><span>$${sub.toFixed(2)}</span></div>`;
  if (disc > 0) {
    const discLabel = tab.discountPct ? (tab.discountPct * 100).toFixed(0) + '% discount' : 'Discount';
    html += `<div class="rcpt-row"><span>${discLabel}</span><span>-$${disc.toFixed(2)}</span></div>`;
  }
  html += `<div class="rcpt-row"><span>Tax (${taxPct}%)</span><span>$${tax.toFixed(2)}</span></div>`;
  if (grat > 0) {
    html += `<div class="rcpt-row"><span>Gratuity (${(tab.autoGrat * 100).toFixed(0)}%)</span><span>$${grat.toFixed(2)}</span></div>`;
  }
  if (tip > 0 && !tab.autoGrat) {
    html += `<div class="rcpt-row"><span>Tip</span><span>$${tip.toFixed(2)}</span></div>`;
  }
  // Deposit split payment
  const depositUsed = tab.depositUsed || 0;
  const depositUnused = tab.depositUnused || 0;
  const balanceDue = tab.balanceDue || 0;

  if (depositUsed > 0) {
    html += `<div class="rcpt-row"><span>Deposit Applied</span><span>-$${depositUsed.toFixed(2)}</span></div>`;
    if (depositUnused > 0) {
      html += `<div class="rcpt-row"><span>Unused Deposit → Other Income</span><span>$${depositUnused.toFixed(2)}</span></div>`;
    }
    if (balanceDue > 0) {
      html += `<div class="rcpt-row"><span>Balance (${(tab.payMethod || 'card').toUpperCase()})</span><span>$${balanceDue.toFixed(2)}</span></div>`;
    }
    html += `<div class="rcpt-row total"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>`;
  } else {
    html += `<div class="rcpt-row total"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>`;
  }

  // Min spend note — check subtotal + tax (no grat)
  if (tab.minSpendRequired && tab.minSpendRequired > 0) {
    const subWithTax = sub + tax;
    const met = subWithTax >= tab.minSpendRequired;
    html += `<div class="rcpt-center rcpt-sm" style="margin-top:4px;color:${met ? '#27AE60' : '#E74C3C'}">Min Spend: $${tab.minSpendRequired.toFixed(0)} ${met ? '(MET)' : '(NOT MET)'}</div>`;
  }

  html += '<hr class="rcpt-divider">';

  // Footer
  const footer = CONFIG.receipt_footer || 'Thank you for dining with us!';
  html += `<div class="rcpt-center rcpt-sm">${footer}</div>`;

  el.innerHTML = html;
  openModal('receiptModal');
}

// ── PRINT TO THERMAL PRINTER ─────────────────────────
async function printReceipt() {
  if (!_lastReceiptTab) {
    showToast('No receipt to print');
    return;
  }

  const btn = document.querySelector('.receipt-print-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'PRINTING...'; }

  try {
    // Build the tab payload the escpos driver expects
    const tab = _lastReceiptTab;
    const staffMap = {};
    STAFF.forEach(s => staffMap[s.id] = s.name);

    const printTab = {
      orderNum: tab.orderNum,
      saleNum: tab.saleNum,
      name: tab.name,
      payMethod: tab.payMethod,
      serverName: staffMap[tab.createdBy] || 'Staff',
      station: STATION.label,
      closedAt: tab.closedAt,
      tableNum: tab.tableNum,
      guestCount: tab.guestCount,
      lines: tab.lines,
      discountPct: tab.discountPct,
      discountAmt: tab.discountAmt,
      autoGrat: tab.autoGrat,
      tipAmount: tab.tipAmount,
      depositUsed: tab.depositUsed,
      depositUnused: tab.depositUnused,
      balanceDue: tab.balanceDue,
      minSpendRequired: tab.minSpendRequired,
    };

    await serverPost('/api/printer/receipt', {
      tab: printTab,
      config: {
        tax_rate: CONFIG.tax_rate,
        receipt_footer: CONFIG.receipt_footer,
        venue_name: CONFIG.venue_name,
        venue_subtitle: CONFIG.venue_subtitle,
        venue_city: CONFIG.venue_city,
      },
    });

    showToast('Receipt printed');
  } catch (e) {
    showToast('Print failed: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'PRINT'; }
  }
}

function closeReceipt() {
  _lastReceiptTab = null;
  closeModal('receiptModal');
}
