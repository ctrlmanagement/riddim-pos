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
