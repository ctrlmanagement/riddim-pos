/* RIDDIM POS — Receipt Preview */
'use strict';

// ═══════════════════════════════════════════
// RECEIPT PREVIEW
// ═══════════════════════════════════════════

function showReceipt(tab) {
  const el = document.getElementById('receiptBody');
  if (!el) return;

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
  html += '<div class="rcpt-center rcpt-brand">RIDDIM</div>';
  html += '<div class="rcpt-center rcpt-sm">SUPPER CLUB</div>';
  html += '<div class="rcpt-center rcpt-sm">Atlanta, GA</div>';
  html += '<hr class="rcpt-divider">';

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
  html += `<div class="rcpt-row total"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>`;

  html += '<hr class="rcpt-divider">';

  // Footer
  const footer = CONFIG.receipt_footer || 'Thank you for dining with us!';
  html += `<div class="rcpt-center rcpt-sm">${footer}</div>`;

  el.innerHTML = html;
  openModal('receiptModal');
}

function closeReceipt() {
  closeModal('receiptModal');
}
