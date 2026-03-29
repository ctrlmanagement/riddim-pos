/* RIDDIM POS — Clock In/Out + Checkout */
'use strict';

// ═══════════════════════════════════════════
// CLOCK IN / OUT
// ═══════════════════════════════════════════

let clockPinBuffer = '';
let clockEntries = []; // in-memory log: { staffId, staffName, type: 'in'|'out', time }

function openClockInOut() {
  clockPinBuffer = '';
  updateClockPinDots();
  document.getElementById('clockStatus').textContent = 'Enter your 4-digit PIN';
  document.getElementById('clockResult').innerHTML = '';
  openModal('clockModal');
}

function clockPinPress(digit) {
  if (clockPinBuffer.length >= 4) return;
  clockPinBuffer += digit;
  updateClockPinDots();
  if (clockPinBuffer.length === 4) {
    setTimeout(clockPinSubmit, 200);
  }
}

function clockPinClear() {
  clockPinBuffer = '';
  updateClockPinDots();
  document.getElementById('clockStatus').textContent = 'Enter your 4-digit PIN';
  document.getElementById('clockResult').innerHTML = '';
}

function updateClockPinDots() {
  const dots = document.querySelectorAll('#clockModal .pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < clockPinBuffer.length);
  });
}

let pendingClockOutStaff = null; // staff waiting for checkout before clock out

async function clockPinSubmit() {
  const staff = STAFF.find(s => s.pin === clockPinBuffer);
  if (!staff) {
    document.getElementById('clockStatus').textContent = 'Invalid PIN';
    document.getElementById('clockStatus').style.color = 'var(--red)';
    clockPinBuffer = '';
    updateClockPinDots();
    setTimeout(() => {
      document.getElementById('clockStatus').style.color = '';
      document.getElementById('clockStatus').textContent = 'Enter your 4-digit PIN';
    }, 2000);
    return;
  }

  // Check if currently clocked in
  const lastEntry = [...clockEntries].reverse().find(e => e.staffId === staff.id);
  const isClockedIn = lastEntry && lastEntry.type === 'in';
  const now = new Date();
  const type = isClockedIn ? 'out' : 'in';

  if (type === 'out') {
    // Check for open tabs — block clock out if any
    const openTabs = tabs.filter(t =>
      (t.status === 'open' || t.status === 'sent') && t.createdBy === staff.id
    );
    if (openTabs.length > 0) {
      document.getElementById('clockStatus').textContent = '';
      document.getElementById('clockResult').innerHTML = `
        <div class="clock-result-card out" style="border-color:var(--orange);background:rgba(243,156,18,0.1)">
          <div class="clock-result-name">${staff.name}</div>
          <div class="clock-result-action" style="color:var(--orange)">OPEN TABS (${openTabs.length})</div>
          <div class="clock-result-time" style="color:var(--red)">Close all tabs before clocking out</div>
        </div>`;
      clockPinBuffer = '';
      updateClockPinDots();
      return;
    }

    // Must pull checkout report before clocking out
    pendingClockOutStaff = staff;
    closeModal('clockModal');
    showStaffCheckout(staff);
    return;
  }

  // Clock IN — persist to server first, then update local state
  if (typeof serverClockIn === 'function') {
    const result = await serverClockIn(staff.id, staff.name);
    if (result && result.error) {
      document.getElementById('clockStatus').textContent = result.error;
      document.getElementById('clockStatus').style.color = 'var(--red)';
      clockPinBuffer = '';
      updateClockPinDots();
      setTimeout(() => {
        document.getElementById('clockStatus').style.color = '';
        document.getElementById('clockStatus').textContent = 'Enter your 4-digit PIN';
      }, 2000);
      return;
    }
  }

  clockEntries.push({ staffId: staff.id, staffName: staff.name, type: 'in', time: now });

  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  document.getElementById('clockResult').innerHTML = `
    <div class="clock-result-card in">
      <div class="clock-result-name">${staff.name}</div>
      <div class="clock-result-action">CLOCKED IN</div>
      <div class="clock-result-time">${timeStr}</div>
    </div>`;

  document.getElementById('clockStatus').textContent = '';
  clockPinBuffer = '';
  updateClockPinDots();

  setTimeout(() => {
    if (document.getElementById('clockModal').classList.contains('active')) {
      closeModal('clockModal');
    }
  }, 3000);
}

// ═══════════════════════════════════════════
// STAFF CHECKOUT REPORT
// ═══════════════════════════════════════════

function showStaffCheckout(staff) {
  const el = document.getElementById('checkoutReport');
  if (!el) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

  // Get this staff member's closed tabs for today
  const staffTabs = tabs.filter(t =>
    t.createdBy === staff.id && (t.status === 'closed' || t.status === 'paid')
  );

  // Payment summary
  let cashSales = 0, cashTips = 0, cardSales = 0, cardTips = 0, compTotal = 0;
  let voidCount = 0, compCount = 0, discountTotal = 0;
  const catSales = {};
  const itemSales = {};

  staffTabs.forEach(t => {
    const sub = tabSubtotal(t);
    const disc = tabDiscountAmount(t);
    const net = sub - disc;
    const tax = tabTax(t);
    const total = net + tax;
    const tip = t.tipAmount || 0;

    if (t.payMethod === 'cash') { cashSales += total; cashTips += tip; }
    else if (t.payMethod === 'card') { cardSales += total; cardTips += tip; }
    else if (t.payMethod === 'comp') { compTotal += total; }

    discountTotal += disc;

    // Item + category breakdown
    t.lines.forEach(l => {
      if (l.voided) { voidCount++; return; }
      if (l.comped) { compCount++; }

      // Category
      const item = MENU_ITEMS.find(m => m.id === l.menuItemId);
      const catId = item ? item.cat : 'unknown';
      const catObj = MENU_CATEGORIES.find(c => c.id === catId);
      const catName = catObj ? catObj.name : 'OTHER';
      if (!catSales[catName]) catSales[catName] = 0;
      if (!l.comped) catSales[catName] += l.price * l.qty;

      // Items
      if (!itemSales[l.name]) itemSales[l.name] = { qty: 0, sales: 0 };
      itemSales[l.name].qty += l.qty;
      if (!l.comped) itemSales[l.name].sales += l.price * l.qty;
    });
  });

  const totalSales = cashSales + cardSales;
  const totalTips = cashTips + cardTips;
  const srvCharge = totalSales * CONFIG.tax_rate;

  // Clock hours
  const clockIn = clockEntries.find(e => e.staffId === staff.id && e.type === 'in');
  const clockInStr = clockIn ? new Date(clockIn.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
  let shiftMin = 0;
  if (clockIn) shiftMin = Math.floor((now - new Date(clockIn.time)) / 60000);
  const shiftStr = shiftMin > 0 ? Math.floor(shiftMin / 60) + 'h ' + (shiftMin % 60) + 'm' : '—';

  let html = `
    <div class="co-header">
      <div class="co-brand">RIDDIM SUPPER CLUB</div>
      <div class="co-title">Daily Checkout</div>
      <div class="co-meta">${staff.name} — ${STATION.label}</div>
      <div class="co-meta">${dateStr} at ${timeStr}</div>
      <div class="co-meta">Clock In: ${clockInStr} — Shift: ${shiftStr}</div>
    </div>
    <div class="co-divider"></div>

    <div class="co-section-title">NET SALES SUMMARY</div>
    <div class="co-row"><span>Sales</span><span>$${totalSales.toFixed(2)}</span></div>
    <div class="co-row"><span>- Voids</span><span>${voidCount} items</span></div>
    <div class="co-row"><span>- Comps</span><span>${compCount} items</span></div>
    <div class="co-row"><span>- Discounts</span><span>$${discountTotal.toFixed(2)}</span></div>
    <div class="co-divider"></div>

    <div class="co-section-title">PAYMENT SUMMARY</div>
    <div class="co-row head"><span>Method</span><span>Sales</span><span>Tips</span><span>Total</span></div>
    <div class="co-row"><span>Card</span><span>$${cardSales.toFixed(2)}</span><span>$${cardTips.toFixed(2)}</span><span>$${(cardSales + cardTips).toFixed(2)}</span></div>
    <div class="co-row"><span>Cash</span><span>$${cashSales.toFixed(2)}</span><span>$${cashTips.toFixed(2)}</span><span>$${(cashSales + cashTips).toFixed(2)}</span></div>
    ${compTotal > 0 ? `<div class="co-row"><span>Comp</span><span>$${compTotal.toFixed(2)}</span><span>—</span><span>$${compTotal.toFixed(2)}</span></div>` : ''}
    <div class="co-row total"><span>Total</span><span>$${totalSales.toFixed(2)}</span><span>$${totalTips.toFixed(2)}</span><span>$${(totalSales + totalTips).toFixed(2)}</span></div>
    <div class="co-divider"></div>

    <div class="co-section-title">CATEGORY SALES</div>`;

  const cats = Object.entries(catSales).sort((a, b) => b[1] - a[1]);
  cats.forEach(([name, sales]) => {
    html += `<div class="co-row"><span>${name}</span><span>$${sales.toFixed(2)}</span></div>`;
  });

  html += `<div class="co-divider"></div>
    <div class="co-section-title">ITEM SUMMARY</div>
    <div class="co-row head"><span>Item</span><span>Qty</span><span>Sales</span></div>`;

  const items = Object.entries(itemSales).sort((a, b) => b[1].sales - a[1].sales);
  items.forEach(([name, d]) => {
    html += `<div class="co-row"><span>${name}</span><span>${d.qty}</span><span>$${d.sales.toFixed(2)}</span></div>`;
  });

  html += `<div class="co-divider"></div>
    <div class="co-row total"><span>Tabs Closed</span><span>${staffTabs.length}</span></div>
    <div class="co-row total"><span>Cash Due</span><span>$${cashSales.toFixed(2)}</span></div>
    <div class="co-row total"><span>Net CC Tips</span><span>$${cardTips.toFixed(2)}</span></div>
    <div class="co-divider"></div>
    <div class="co-section-title">DECLARE TIPS</div>
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0">
      <label style="font-family:var(--font-label);font-size:12px;color:var(--ash);letter-spacing:1px">CASH TIPS $</label>
      <input type="number" id="checkoutDeclaredTips" step="0.01" min="0" placeholder="0.00" value="${cashTips.toFixed(2)}"
             style="width:120px;height:36px;padding:0 8px;border:1px solid var(--surface);border-radius:var(--radius);background:var(--obsidian-mid);color:var(--ivory);font-size:14px">
    </div>`;

  el.innerHTML = html;
  openModal('checkoutModal');
}

function confirmCheckoutAndClockOut() {
  if (!pendingClockOutStaff) { closeModal('checkoutModal'); return; }

  const staff = pendingClockOutStaff;
  const now = new Date();
  const declaredTips = parseFloat(document.getElementById('checkoutDeclaredTips')?.value) || 0;

  clockEntries.push({ staffId: staff.id, staffName: staff.name, type: 'out', time: now, declaredTips });
  staff.checkedOut = true;

  // Persist to local server
  if (typeof serverClockOut === 'function') serverClockOut(staff.id, declaredTips);

  closeModal('checkoutModal');
  showToast(staff.name + ' clocked out' + (declaredTips > 0 ? ` — $${declaredTips.toFixed(2)} declared tips` : ''));
  pendingClockOutStaff = null;
}
