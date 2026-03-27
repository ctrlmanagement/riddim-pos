/* RIDDIM POS — Management: FOH Reports */
'use strict';

// ═══════════════════════════════════════════
// FOH REPORTS
// ═══════════════════════════════════════════

function switchReport(type) {
  document.querySelectorAll('.rpt-tab').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.rpt-tab[data-rpt="${type}"]`);
  if (btn) btn.classList.add('active');
  renderReport(type);
}

function getClosedTabs() {
  return tabs.filter(t => t.status === 'closed' || t.status === 'paid');
}

function renderReport(type) {
  const el = document.getElementById('rptContent');
  if (!el) return;

  if (type === 'summary') renderReportSummary(el);
  else if (type === 'product') renderReportProduct(el);
  else if (type === 'employee') renderReportEmployee(el);
  else if (type === 'hourly') renderReportHourly(el);
  else if (type === 'station') renderReportStation(el);
  else if (type === 'dsr') renderReportDSR(el);
  else if (type === 'checkout') renderReportCheckout(el);
  else if (type === 'paidouts') renderReportPaidOuts(el);
  else if (type === 'custom') renderReportCustom(el);
}

function renderReportSummary(el) {
  const closed = getClosedTabs();
  const voided = tabs.filter(t => t.status === 'voided');
  const open = tabs.filter(t => t.status === 'open' || t.status === 'sent');

  let gross = 0, discounts = 0, comps = 0, tax = 0, tips = 0;
  let cardCount = 0, cashCount = 0, compCount = 0;

  closed.forEach(t => {
    const sub = tabSubtotal(t);
    const disc = tabDiscountAmount(t);
    const compAmt = t.lines.filter(l => l.comped).reduce((s, l) => s + l.price * l.qty, 0);
    gross += sub;
    discounts += disc;
    comps += compAmt;
    tax += tabTax(t);
    tips += t.tipAmount || 0;
    if (t.payMethod === 'card') cardCount++;
    else if (t.payMethod === 'cash') cashCount++;
    else if (t.payMethod === 'comp') compCount++;
  });

  const net = gross - discounts - comps;
  const avgCheck = closed.length > 0 ? (net + tax) / closed.length : 0;

  el.innerHTML = `
    <div class="rpt-grid">
      <div class="rpt-card">
        <div class="rpt-card-val">$${gross.toFixed(2)}</div>
        <div class="rpt-card-lbl">GROSS SALES</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${net.toFixed(2)}</div>
        <div class="rpt-card-lbl">NET SALES</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${tax.toFixed(2)}</div>
        <div class="rpt-card-lbl">TAX</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${tips.toFixed(2)}</div>
        <div class="rpt-card-lbl">TIPS</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">${closed.length}</div>
        <div class="rpt-card-lbl">CHECKS CLOSED</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${avgCheck.toFixed(2)}</div>
        <div class="rpt-card-lbl">AVG CHECK</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${discounts.toFixed(2)}</div>
        <div class="rpt-card-lbl">DISCOUNTS</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">$${comps.toFixed(2)}</div>
        <div class="rpt-card-lbl">COMPS</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-val">${voided.length}</div>
        <div class="rpt-card-lbl">VOIDED</div>
      </div>
    </div>
    <div class="rpt-section">
      <div class="rpt-row"><span>CARD</span><span>${cardCount} checks</span></div>
      <div class="rpt-row"><span>CASH</span><span>${cashCount} checks</span></div>
      <div class="rpt-row"><span>COMP</span><span>${compCount} checks</span></div>
      <div class="rpt-row"><span>OPEN</span><span class="${open.length ? 'text-red' : ''}">${open.length} tabs</span></div>
    </div>
  `;
}

function renderReportProduct(el) {
  const closed = getClosedTabs();
  const itemTotals = {};

  closed.forEach(t => {
    t.lines.forEach(l => {
      if (l.voided) return;
      const key = l.menuItemId || l.name;
      if (!itemTotals[key]) {
        itemTotals[key] = { name: l.name, qty: 0, revenue: 0 };
      }
      itemTotals[key].qty += l.qty;
      if (!l.comped) itemTotals[key].revenue += l.price * l.qty;
    });
  });

  const items = Object.values(itemTotals).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);

  if (items.length === 0) {
    el.innerHTML = '<div class="mgmt-empty">No sales data</div>';
    return;
  }

  el.innerHTML = `
    <table class="mgmt-table">
      <thead><tr><th>ITEM</th><th>QTY</th><th>REVENUE</th><th>% MIX</th></tr></thead>
      <tbody>
        ${items.map(i => `<tr>
          <td>${i.name}</td>
          <td>${i.qty}</td>
          <td>$${i.revenue.toFixed(2)}</td>
          <td>${totalRevenue > 0 ? ((i.revenue / totalRevenue) * 100).toFixed(1) + '%' : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function renderReportEmployee(el) {
  const closed = getClosedTabs();
  const staffTotals = {};

  // Build staff name map
  const staffMap = {};
  STAFF.forEach(s => staffMap[s.id] = s.name);

  closed.forEach(t => {
    const staffId = t.createdBy;
    const name = staffMap[staffId] || 'Unknown';
    if (!staffTotals[staffId]) {
      staffTotals[staffId] = { name, tabs: 0, sales: 0, tips: 0, items: 0 };
    }
    staffTotals[staffId].tabs++;
    staffTotals[staffId].sales += tabSubtotal(t) - tabDiscountAmount(t) + tabTax(t);
    staffTotals[staffId].tips += t.tipAmount || 0;
    staffTotals[staffId].items += t.lines.filter(l => !l.voided).reduce((s, l) => s + l.qty, 0);
  });

  const employees = Object.values(staffTotals).sort((a, b) => b.sales - a.sales);

  if (employees.length === 0) {
    el.innerHTML = '<div class="mgmt-empty">No sales data</div>';
    return;
  }

  el.innerHTML = `
    <table class="mgmt-table">
      <thead><tr><th>SERVER</th><th>TABS</th><th>ITEMS</th><th>SALES</th><th>TIPS</th></tr></thead>
      <tbody>
        ${employees.map(e => `<tr>
          <td>${e.name}</td>
          <td>${e.tabs}</td>
          <td>${e.items}</td>
          <td>$${e.sales.toFixed(2)}</td>
          <td>$${e.tips.toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function renderReportHourly(el) {
  const closed = getClosedTabs();
  const hourly = {};

  closed.forEach(t => {
    const hour = new Date(t.createdAt).getHours();
    if (!hourly[hour]) hourly[hour] = { tabs: 0, sales: 0, items: 0 };
    hourly[hour].tabs++;
    hourly[hour].sales += tabSubtotal(t) - tabDiscountAmount(t) + tabTax(t);
    hourly[hour].items += t.lines.filter(l => !l.voided).reduce((s, l) => s + l.qty, 0);
  });

  const hours = Object.keys(hourly).map(Number).sort((a, b) => a - b);

  if (hours.length === 0) {
    el.innerHTML = '<div class="mgmt-empty">No sales data</div>';
    return;
  }

  el.innerHTML = `
    <table class="mgmt-table">
      <thead><tr><th>HOUR</th><th>TABS</th><th>ITEMS</th><th>SALES</th></tr></thead>
      <tbody>
        ${hours.map(h => {
          const d = hourly[h];
          const label = ((h % 12) || 12) + (h < 12 ? ' AM' : ' PM');
          return `<tr>
            <td>${label}</td>
            <td>${d.tabs}</td>
            <td>${d.items}</td>
            <td>$${d.sales.toFixed(2)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderReportStation(el) {
  const closed = getClosedTabs();
  const stationTotals = {};

  closed.forEach(t => {
    const st = t.station || 'Unknown';
    if (!stationTotals[st]) stationTotals[st] = { tabs: 0, sales: 0, items: 0 };
    stationTotals[st].tabs++;
    stationTotals[st].sales += tabSubtotal(t) - tabDiscountAmount(t) + tabTax(t);
    stationTotals[st].items += t.lines.filter(l => !l.voided).reduce((s, l) => s + l.qty, 0);
  });

  const stations = Object.entries(stationTotals).sort((a, b) => b[1].sales - a[1].sales);

  if (stations.length === 0) {
    el.innerHTML = '<div class="mgmt-empty">No sales data</div>';
    return;
  }

  // Map station codes to labels
  const stLabel = {};
  STATIONS.forEach(s => stLabel[s.code] = s.label);

  el.innerHTML = `
    <table class="mgmt-table">
      <thead><tr><th>STATION</th><th>TABS</th><th>ITEMS</th><th>SALES</th></tr></thead>
      <tbody>
        ${stations.map(([code, d]) => `<tr>
          <td>${stLabel[code] || code}</td>
          <td>${d.tabs}</td>
          <td>${d.items}</td>
          <td>$${d.sales.toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

// ═══════════════════════════════════════════
// DSR — DAILY SUMMARY REPORT
// ═══════════════════════════════════════════

async function renderReportDSR(el) {
  el.innerHTML = '<div class="mgmt-empty">Loading DSR...</div>';

  const data = await serverGet('/api/reports/dsr');
  if (!data) {
    el.innerHTML = '<div class="mgmt-empty">Failed to load DSR — check server connection</div>';
    return;
  }

  const d = data;
  const pay = d.payments || {};
  const cash = pay.cash || { count: 0, sales: 0, tips: 0 };
  const card = pay.card || { count: 0, sales: 0, tips: 0 };
  const comp = pay.comp || { count: 0, sales: 0 };
  const cr = d.cash_reconciliation || {};

  el.innerHTML = `
    <div style="max-width:600px">
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button class="mgmt-action-btn" onclick="exportReportPDF('dsr')" style="font-size:12px">EXPORT PDF</button>
      </div>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-family:var(--font-display);font-size:20px;color:var(--gold);letter-spacing:2px">RIDDIM SUPPER CLUB</div>
        <div style="font-family:var(--font-label);font-size:18px;color:var(--ivory);letter-spacing:2px">Daily Summary</div>
        <div style="font-size:12px;color:var(--ash);margin-top:4px">${d.date_from}${d.date_from !== d.date_to ? ' — ' + d.date_to : ''}</div>
      </div>

      <!-- Sales Summary -->
      <div class="dsr-section">
        <div class="dsr-section-title">SALES SUMMARY</div>
        <div class="dsr-row"><span>Gross Sales</span><span>$${d.gross_sales.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Less Discounts</span><span>-$${d.discounts.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Less Comps</span><span>-$${d.comp_total.toFixed(2)}</span></div>
        <div class="dsr-row total"><span>Net Sales</span><span>$${d.net_sales.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Sales Tax</span><span>$${d.sales_tax.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Service Fees</span><span>$${d.service_fees.toFixed(2)}</span></div>
        <div class="dsr-row total"><span>Gross Revenue</span><span>$${d.gross_revenue.toFixed(2)}</span></div>
      </div>

      <!-- Quick Stats -->
      <div class="rpt-grid" style="margin-top:16px">
        <div class="rpt-card"><div class="rpt-card-val">${d.order_count}</div><div class="rpt-card-lbl">CHECKS</div></div>
        <div class="rpt-card"><div class="rpt-card-val">${d.guest_count}</div><div class="rpt-card-lbl">GUESTS</div></div>
        <div class="rpt-card"><div class="rpt-card-val">$${d.avg_check.toFixed(2)}</div><div class="rpt-card-lbl">AVG CHECK</div></div>
      </div>

      <!-- Payment Summary -->
      <div class="dsr-section">
        <div class="dsr-section-title">PAYMENT SUMMARY</div>
        <div class="dsr-row head"><span>Method</span><span>Count</span><span>Sales</span><span>Tips</span><span>Total</span></div>
        <div class="dsr-row"><span>Card</span><span>${card.count}</span><span>$${card.sales.toFixed(2)}</span><span>$${card.tips.toFixed(2)}</span><span>$${(card.sales + card.tips).toFixed(2)}</span></div>
        <div class="dsr-row"><span>Cash</span><span>${cash.count}</span><span>$${cash.sales.toFixed(2)}</span><span>$${cash.tips.toFixed(2)}</span><span>$${(cash.sales + cash.tips).toFixed(2)}</span></div>
        ${comp.count > 0 ? `<div class="dsr-row"><span>Comp</span><span>${comp.count}</span><span>$${comp.sales.toFixed(2)}</span><span>—</span><span>$${comp.sales.toFixed(2)}</span></div>` : ''}
        <div class="dsr-row total"><span>Total</span><span>${card.count + cash.count + comp.count}</span><span>$${(card.sales + cash.sales + comp.sales).toFixed(2)}</span><span>$${d.total_tips.toFixed(2)}</span><span>$${(card.sales + cash.sales + comp.sales + d.total_tips).toFixed(2)}</span></div>
      </div>

      <!-- Expenditures -->
      <div class="dsr-section">
        <div class="dsr-section-title">EXPENDITURES / ADJUSTMENTS</div>
        ${d.paid_outs.length > 0
          ? d.paid_outs.map(po => `<div class="dsr-row"><span>${po.category} (${po.count})</span><span>$${po.total.toFixed(2)}</span></div>`).join('')
          : '<div class="dsr-row"><span style="color:var(--ash)">No paid outs</span><span>$0.00</span></div>'
        }
        <div class="dsr-row total"><span>Total Paid Outs</span><span>$${d.total_paid_outs.toFixed(2)}</span></div>
      </div>

      <!-- Cash Reconciliation -->
      <div class="dsr-section">
        <div class="dsr-section-title">CASH RECONCILIATION</div>
        <div class="dsr-row"><span>Gross Cash</span><span>$${cr.gross_cash.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Less Tips</span><span>-$${cr.less_tips.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Less Paid Outs</span><span>-$${cr.paid_outs.toFixed(2)}</span></div>
        <div class="dsr-row total"><span>Net Cash Retained</span><span>$${cr.net_cash_retained.toFixed(2)}</span></div>
        <div class="dsr-row total"><span>Cash Deposit</span><span>$${cr.cash_deposit.toFixed(2)}</span></div>
      </div>

      <!-- Comp Summary -->
      ${d.comps_by_reason.length > 0 ? `
      <div class="dsr-section">
        <div class="dsr-section-title">COMP SUMMARY</div>
        ${d.comps_by_reason.map(c => `<div class="dsr-row"><span>${c.reason} (${c.count})</span><span>$${c.amount.toFixed(2)}</span></div>`).join('')}
        <div class="dsr-row total"><span>Total Comps</span><span>$${d.comp_total.toFixed(2)}</span></div>
      </div>` : ''}

      <!-- Void Summary -->
      ${d.voids_by_reason.length > 0 ? `
      <div class="dsr-section">
        <div class="dsr-section-title">VOID SUMMARY</div>
        ${d.voids_by_reason.map(v => `<div class="dsr-row"><span>${v.reason} (${v.count})</span><span>$${v.amount.toFixed(2)}</span></div>`).join('')}
      </div>` : ''}
    </div>
  `;
}

// ═══════════════════════════════════════════
// CHECKOUT — PER-SERVER SHIFT REPORT
// ═══════════════════════════════════════════

async function renderReportCheckout(el) {
  // Show staff picker first
  const staffMap = {};
  STAFF.forEach(s => staffMap[s.id] = s.name);

  // Get staff who have sales today
  const closed = getClosedTabs();
  const activeStaff = {};
  closed.forEach(t => {
    if (t.createdBy && !activeStaff[t.createdBy]) {
      activeStaff[t.createdBy] = staffMap[t.createdBy] || 'Unknown';
    }
  });

  const staffList = Object.entries(activeStaff);

  if (staffList.length === 0) {
    el.innerHTML = '<div class="mgmt-empty">No server sales today</div>';
    return;
  }

  el.innerHTML = `
    <div class="po-step-title">SELECT SERVER</div>
    <div class="po-categories">
      ${staffList.map(([id, name]) => `
        <button class="po-cat-btn" onclick="loadCheckoutReport('${id}')">${name}</button>
      `).join('')}
    </div>
    <div id="checkoutReportContent" style="margin-top:20px"></div>
  `;
}

async function loadCheckoutReport(staffId) {
  const target = document.getElementById('checkoutReportContent');
  if (!target) return;
  target.innerHTML = '<div class="mgmt-empty">Loading...</div>';

  const d = await serverGet('/api/reports/checkout/' + staffId);
  if (!d) {
    target.innerHTML = '<div class="mgmt-empty">Failed to load checkout report</div>';
    return;
  }

  const pay = d.payments || {};
  const cash = pay.cash || { count: 0, sales: 0, tips: 0 };
  const card = pay.card || { count: 0, sales: 0, tips: 0 };
  const comp = pay.comp || { count: 0, sales: 0 };

  // Clock entries
  let clockHtml = '';
  if (d.clock_entries && d.clock_entries.length > 0) {
    d.clock_entries.forEach(c => {
      const inStr = new Date(c.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const outStr = c.clock_out ? new Date(c.clock_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'still in';
      clockHtml += `<div class="dsr-row"><span>Shift</span><span>${inStr} — ${outStr}</span></div>`;
    });
  }

  target.innerHTML = `
    <div style="max-width:500px">
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button class="mgmt-action-btn" onclick="exportReportPDF('checkout/${staffId}')" style="font-size:12px">EXPORT PDF</button>
      </div>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-family:var(--font-display);font-size:20px;color:var(--gold);letter-spacing:2px">RIDDIM SUPPER CLUB</div>
        <div style="font-family:var(--font-label);font-size:18px;color:var(--ivory);letter-spacing:2px">Server Checkout</div>
        <div style="font-size:14px;color:var(--ivory);margin-top:4px">${d.staff_name}</div>
        <div style="font-size:12px;color:var(--ash)">${d.date_from} — ${d.hours_worked}h worked</div>
      </div>

      ${clockHtml ? `<div class="dsr-section">${clockHtml}</div>` : ''}

      <div class="rpt-grid" style="margin-top:16px">
        <div class="rpt-card"><div class="rpt-card-val">${d.tabs}</div><div class="rpt-card-lbl">TABS</div></div>
        <div class="rpt-card"><div class="rpt-card-val">$${d.cash_due.toFixed(2)}</div><div class="rpt-card-lbl">CASH DUE</div></div>
        <div class="rpt-card"><div class="rpt-card-val">$${d.cc_tips.toFixed(2)}</div><div class="rpt-card-lbl">CC TIPS</div></div>
      </div>

      <div class="dsr-section">
        <div class="dsr-section-title">SALES</div>
        <div class="dsr-row"><span>Gross Sales</span><span>$${d.gross_sales.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Discounts</span><span>-$${d.discounts.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Comps (${d.comp_count} items)</span><span>-$${d.comp_total.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Voids</span><span>${d.void_count} items</span></div>
        <div class="dsr-row"><span>Tax</span><span>$${d.tax.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Auto-Grat</span><span>$${d.auto_grat.toFixed(2)}</span></div>
      </div>

      <div class="dsr-section">
        <div class="dsr-section-title">PAYMENTS</div>
        <div class="dsr-row head"><span>Method</span><span>Count</span><span>Sales</span><span>Tips</span></div>
        <div class="dsr-row"><span>Card</span><span>${card.count}</span><span>$${card.sales.toFixed(2)}</span><span>$${card.tips.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Cash</span><span>${cash.count}</span><span>$${cash.sales.toFixed(2)}</span><span>$${cash.tips.toFixed(2)}</span></div>
        ${comp.count > 0 ? `<div class="dsr-row"><span>Comp</span><span>${comp.count}</span><span>$${comp.sales.toFixed(2)}</span><span>—</span></div>` : ''}
      </div>

      ${d.items.length > 0 ? `
      <div class="dsr-section">
        <div class="dsr-section-title">ITEMS SOLD</div>
        <div class="dsr-row head"><span>Item</span><span>Qty</span><span>Revenue</span></div>
        ${d.items.slice(0, 20).map(i => `<div class="dsr-row"><span>${i.name}</span><span>${i.qty}</span><span>$${i.revenue.toFixed(2)}</span></div>`).join('')}
        ${d.items.length > 20 ? `<div class="dsr-row" style="color:var(--ash)"><span>+ ${d.items.length - 20} more items</span></div>` : ''}
      </div>` : ''}
    </div>
  `;
}

// ═══════════════════════════════════════════
// PAID OUT SUMMARY REPORT
// ═══════════════════════════════════════════

async function renderReportPaidOuts(el) {
  el.innerHTML = '<div class="mgmt-empty">Loading paid outs...</div>';

  const d = await serverGet('/api/reports/paid-out-summary');
  if (!d) {
    el.innerHTML = '<div class="mgmt-empty">Failed to load paid out summary — check server connection</div>';
    return;
  }

  if (d.categories.length === 0) {
    el.innerHTML = '<div class="mgmt-empty">No paid outs recorded today</div>';
    return;
  }

  // Group details by category
  const grouped = {};
  d.details.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  el.innerHTML = `
    <div style="max-width:600px">
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button class="mgmt-action-btn" onclick="exportReportPDF('paid-out-summary')" style="font-size:12px">EXPORT PDF</button>
      </div>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-family:var(--font-display);font-size:20px;color:var(--gold);letter-spacing:2px">RIDDIM SUPPER CLUB</div>
        <div style="font-family:var(--font-label);font-size:18px;color:var(--ivory);letter-spacing:2px">Paid Out Summary</div>
        <div style="font-size:12px;color:var(--ash);margin-top:4px">${d.date_from}${d.date_from !== d.date_to ? ' — ' + d.date_to : ''}</div>
      </div>

      ${d.categories.map(cat => `
        <div class="dsr-section">
          <div class="dsr-section-title">${cat.category.toUpperCase()}</div>
          <div class="dsr-row head"><span>Amount</span><span>Notes</span><span>Staff</span><span>Time</span></div>
          ${(grouped[cat.category] || []).map(item => `
            <div class="dsr-row">
              <span>$${item.amount.toFixed(2)}</span>
              <span>${item.notes || '—'}</span>
              <span>${item.staff_name}</span>
              <span>${new Date(item.recorded_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
            </div>
          `).join('')}
          <div class="dsr-row total"><span>Category Total</span><span></span><span></span><span>$${cat.total.toFixed(2)}</span></div>
        </div>
      `).join('')}

      <div class="dsr-section" style="background:var(--surface)">
        <div class="dsr-row total" style="font-size:18px">
          <span>TOTAL PAID OUTS</span>
          <span>$${d.grand_total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════
// CUSTOM REPORT BUILDER
// ═══════════════════════════════════════════

const CUSTOM_SECTIONS = [
  { id: 'sales_summary', label: 'Sales Summary' },
  { id: 'payment_summary', label: 'Payment Breakdown' },
  { id: 'cash_reconciliation', label: 'Cash Reconciliation' },
  { id: 'paid_outs', label: 'Paid Outs by Category' },
  { id: 'comp_summary', label: 'Comp Summary' },
  { id: 'void_summary', label: 'Void Summary' },
  { id: 'employee_sales', label: 'Employee Sales' },
  { id: 'employee_tips', label: 'Employee Tips' },
  { id: 'hourly_sales', label: 'Hourly Sales' },
  { id: 'station_sales', label: 'Station Sales' },
  { id: 'product_mix', label: 'Product Mix' },
  { id: 'clock_entries', label: 'Clock In/Out Log' },
  { id: 'top_items', label: 'Top 10 Items' },
];

let customSelectedSections = [];
let customPresets = [];

// Load presets from localStorage
function loadCustomPresets() {
  try {
    const raw = localStorage.getItem('riddim_report_presets');
    customPresets = raw ? JSON.parse(raw) : [];
  } catch (e) { customPresets = []; }
}

function saveCustomPresets() {
  localStorage.setItem('riddim_report_presets', JSON.stringify(customPresets));
}

function renderReportCustom(el) {
  loadCustomPresets();

  el.innerHTML = `
    <div style="max-width:700px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <span style="font-family:var(--font-label);font-size:16px;color:var(--gold);letter-spacing:2px">CUSTOM REPORT BUILDER</span>
      </div>

      <!-- Presets -->
      ${customPresets.length > 0 ? `
        <div style="margin-bottom:20px">
          <div class="po-step-title">SAVED PRESETS</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${customPresets.map((p, i) => `
              <button class="po-cat-btn" style="flex:0 0 auto;display:flex;align-items:center;gap:8px" onclick="loadCustomPreset(${i})">
                ${p.name}
                <span onclick="event.stopPropagation();deleteCustomPreset(${i})" style="color:var(--red);font-size:11px;cursor:pointer">&times;</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Section Picker -->
      <div class="po-step-title">SELECT SECTIONS</div>
      <div class="po-categories" style="margin-bottom:16px">
        ${CUSTOM_SECTIONS.map(s => `
          <label class="po-cat-btn" style="display:flex;align-items:center;gap:8px;cursor:pointer"
                 onclick="toggleCustomSection('${s.id}', this)">
            <input type="checkbox" id="cs-${s.id}" ${customSelectedSections.includes(s.id) ? 'checked' : ''}
                   style="accent-color:var(--gold);width:16px;height:16px">
            ${s.label}
          </label>
        `).join('')}
      </div>

      <!-- Date Range -->
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
        <label class="form-label" style="margin:0;color:var(--ash);font-size:12px">FROM</label>
        <input type="date" id="customDateFrom" class="form-input" style="width:160px"
               value="${new Date().toISOString().slice(0, 10)}">
        <label class="form-label" style="margin:0;color:var(--ash);font-size:12px">TO</label>
        <input type="date" id="customDateTo" class="form-input" style="width:160px"
               value="${new Date().toISOString().slice(0, 10)}">
      </div>

      <!-- Preset Name (for saving) -->
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:20px">
        <input type="text" id="customPresetName" class="form-input" placeholder="Preset name (optional)" style="flex:1">
        <button class="mgmt-edit-btn" onclick="saveCurrentPreset()">SAVE PRESET</button>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px">
        <button class="mgmt-action-btn" onclick="generateCustomReport('preview')">PREVIEW</button>
        <button class="mgmt-action-btn" onclick="generateCustomReport('pdf')" style="background:var(--green);border-color:var(--green);color:white">EXPORT PDF</button>
      </div>

      <!-- Preview area -->
      <div id="customReportPreview" style="margin-top:20px"></div>
    </div>
  `;
}

function toggleCustomSection(id, label) {
  const cb = document.getElementById('cs-' + id);
  if (!cb) return;
  // Toggle is handled by native checkbox, just update our state
  setTimeout(() => {
    customSelectedSections = CUSTOM_SECTIONS
      .filter(s => document.getElementById('cs-' + s.id)?.checked)
      .map(s => s.id);
  }, 10);
}

function loadCustomPreset(index) {
  const preset = customPresets[index];
  if (!preset) return;

  customSelectedSections = [...preset.sections];

  // Update checkboxes
  CUSTOM_SECTIONS.forEach(s => {
    const cb = document.getElementById('cs-' + s.id);
    if (cb) cb.checked = customSelectedSections.includes(s.id);
  });

  // Set preset name
  const nameInput = document.getElementById('customPresetName');
  if (nameInput) nameInput.value = preset.name;

  showToast('Loaded preset: ' + preset.name);
}

function deleteCustomPreset(index) {
  customPresets.splice(index, 1);
  saveCustomPresets();
  renderReport('custom');
  showToast('Preset deleted');
}

function saveCurrentPreset() {
  // Read checked sections from DOM
  customSelectedSections = CUSTOM_SECTIONS
    .filter(s => document.getElementById('cs-' + s.id)?.checked)
    .map(s => s.id);

  if (customSelectedSections.length === 0) {
    showToast('Select at least one section');
    return;
  }

  const nameInput = document.getElementById('customPresetName');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    showToast('Enter a preset name');
    return;
  }

  // Check for duplicate name — overwrite
  const existing = customPresets.findIndex(p => p.name === name);
  if (existing >= 0) {
    customPresets[existing].sections = customSelectedSections;
  } else {
    customPresets.push({ name, sections: [...customSelectedSections] });
  }

  saveCustomPresets();
  renderReport('custom');
  showToast('Preset saved: ' + name);
}

async function generateCustomReport(format) {
  // Read checked sections from DOM
  customSelectedSections = CUSTOM_SECTIONS
    .filter(s => document.getElementById('cs-' + s.id)?.checked)
    .map(s => s.id);

  if (customSelectedSections.length === 0) {
    showToast('Select at least one section');
    return;
  }

  const dateFrom = document.getElementById('customDateFrom')?.value || new Date().toISOString().slice(0, 10);
  const dateTo = document.getElementById('customDateTo')?.value || dateFrom;
  const presetName = document.getElementById('customPresetName')?.value?.trim() || 'Custom Report';

  if (format === 'pdf') {
    // Open PDF in new tab via POST form trick
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = SERVER_URL + '/api/reports/custom?date_from=' + dateFrom + '&date_to=' + dateTo;
    form.target = '_blank';

    const addField = (name, value) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    addField('format', 'pdf');
    addField('preset_name', presetName);
    addField('sections', JSON.stringify(customSelectedSections));
    // Express needs JSON body, so we use fetch instead

    form.remove();

    // Use fetch + blob for PDF download
    showToast('Generating PDF...');
    try {
      const resp = await fetch(SERVER_URL + '/api/reports/custom?date_from=' + dateFrom + '&date_to=' + dateTo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: customSelectedSections,
          preset_name: presetName,
          format: 'pdf',
        }),
      });
      if (!resp.ok) throw new Error('PDF generation failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      showToast('PDF export failed — ' + e.message);
    }
    return;
  }

  // Preview — fetch JSON and render inline
  const preview = document.getElementById('customReportPreview');
  if (preview) preview.innerHTML = '<div class="mgmt-empty">Loading preview...</div>';

  try {
    const resp = await fetch(SERVER_URL + '/api/reports/custom?date_from=' + dateFrom + '&date_to=' + dateTo, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sections: customSelectedSections,
        preset_name: presetName,
        format: 'json',
      }),
    });
    const result = await resp.json();
    if (result.error) throw new Error(result.error);

    const d = result.data;

    // Build a quick inline preview from the returned data
    let html = `<div style="text-align:center;margin-bottom:12px">
      <div style="font-family:var(--font-display);font-size:18px;color:var(--gold)">${presetName}</div>
      <div style="font-size:12px;color:var(--ash)">${dateFrom}${dateFrom !== dateTo ? ' — ' + dateTo : ''}</div>
    </div>`;

    // Render selected sections as simple key-value displays
    if (customSelectedSections.includes('sales_summary') && d.gross_sales !== undefined) {
      html += `<div class="dsr-section">
        <div class="dsr-section-title">SALES SUMMARY</div>
        <div class="dsr-row"><span>Gross Sales</span><span>$${d.gross_sales.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Net Sales</span><span>$${d.net_sales.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Tax</span><span>$${d.sales_tax.toFixed(2)}</span></div>
        <div class="dsr-row total"><span>Gross Revenue</span><span>$${d.gross_revenue.toFixed(2)}</span></div>
      </div>`;
    }

    if (customSelectedSections.includes('payment_summary') && d.payments) {
      const cash = d.payments.cash || { sales: 0, tips: 0 };
      const card = d.payments.card || { sales: 0, tips: 0 };
      html += `<div class="dsr-section">
        <div class="dsr-section-title">PAYMENT BREAKDOWN</div>
        <div class="dsr-row"><span>Card Sales</span><span>$${card.sales.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Cash Sales</span><span>$${cash.sales.toFixed(2)}</span></div>
        <div class="dsr-row"><span>Total Tips</span><span>$${d.total_tips.toFixed(2)}</span></div>
      </div>`;
    }

    if (customSelectedSections.includes('paid_outs') && d.paid_outs) {
      html += `<div class="dsr-section">
        <div class="dsr-section-title">PAID OUTS</div>
        ${d.paid_outs.map(p => `<div class="dsr-row"><span>${p.category}</span><span>$${p.total.toFixed(2)}</span></div>`).join('')}
        <div class="dsr-row total"><span>Total</span><span>$${d.total_paid_outs.toFixed(2)}</span></div>
      </div>`;
    }

    if (customSelectedSections.includes('employee_sales') && d.employees) {
      html += `<div class="dsr-section">
        <div class="dsr-section-title">EMPLOYEE SALES</div>
        ${d.employees.map(e => `<div class="dsr-row"><span>${e.server_name}</span><span>$${e.sales.toFixed(2)}</span></div>`).join('')}
      </div>`;
    }

    if (customSelectedSections.includes('station_sales') && d.stations) {
      html += `<div class="dsr-section">
        <div class="dsr-section-title">STATION SALES</div>
        ${d.stations.map(s => `<div class="dsr-row"><span>${s.station}</span><span>$${s.sales.toFixed(2)}</span></div>`).join('')}
      </div>`;
    }

    if (customSelectedSections.includes('product_mix') && d.items) {
      html += `<div class="dsr-section">
        <div class="dsr-section-title">PRODUCT MIX (Top 10)</div>
        ${d.items.slice(0, 10).map(i => `<div class="dsr-row"><span>${i.name}</span><span>$${i.revenue.toFixed(2)}</span></div>`).join('')}
      </div>`;
    }

    html += `<div style="margin-top:16px;text-align:center;color:var(--ash);font-size:12px">
      Preview shows summary — PDF contains full detail
    </div>`;

    if (preview) preview.innerHTML = html;
  } catch (e) {
    if (preview) preview.innerHTML = `<div class="mgmt-empty">Failed: ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════════
// PDF EXPORT HELPER
// ═══════════════════════════════════════════

async function exportReportPDF(type, params) {
  let url = SERVER_URL + '/api/reports/' + type + '/pdf';
  const queryParts = [];

  if (params) {
    if (params.date_from) queryParts.push('date_from=' + params.date_from);
    if (params.date_to) queryParts.push('date_to=' + params.date_to);
  }

  if (queryParts.length > 0) url += '?' + queryParts.join('&');

  showToast('Generating PDF...');
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('PDF generation failed');
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  } catch (e) {
    showToast('PDF export failed — ' + e.message);
  }
}
