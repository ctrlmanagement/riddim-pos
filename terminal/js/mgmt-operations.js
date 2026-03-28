/* RIDDIM POS — Management: Operations */
'use strict';

// ═══════════════════════════════════════════
// VIEW SERVERS — all open tabs by server
// ═══════════════════════════════════════════

function renderMgmtServers() {
  const staffMap = {};
  STAFF.forEach(s => staffMap[s.id] = s.name);

  // Group open tabs by creator
  const serverTabs = {};
  tabs.filter(t => t.status === 'open' || t.status === 'sent').forEach(t => {
    const id = t.createdBy;
    const name = staffMap[id] || 'Unknown';
    if (!serverTabs[id]) serverTabs[id] = { name, tabs: [] };
    serverTabs[id].tabs.push(t);
  });

  const list = document.getElementById('mgmtServersList');
  const servers = Object.values(serverTabs);

  if (servers.length === 0) {
    list.innerHTML = '<div class="mgmt-empty">No open tabs</div>';
    return;
  }

  list.innerHTML = servers.map(s => {
    const totalSales = s.tabs.reduce((sum, t) => sum + tabTotal(t), 0);
    return `
      <div class="server-card">
        <div class="server-card-header">
          <span class="server-card-name">${s.name}</span>
          <span class="server-card-stat">${s.tabs.length} tabs — $${totalSales.toFixed(2)}</span>
        </div>
        <div class="server-card-tabs">
          ${s.tabs.map(t => `
            <div class="server-tab-row" onclick="mgmtSelectTab('${t.id}')">
              <span>${t.name}</span>
              <span>$${tabTotal(t).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function mgmtSelectTab(tabId) {
  activeTabId = tabId;
  renderTabs();
  renderCart();
  switchView('terminal');
}

// ═══════════════════════════════════════════
// STAFF CLOCK — view clock in/out status
// ═══════════════════════════════════════════

function renderMgmtClock() {
  const list = document.getElementById('mgmtClockList');

  // Build per-staff status from clockEntries (defined in clock.js)
  const staffStatus = {};
  STAFF.forEach(s => {
    staffStatus[s.id] = { name: s.name, role: s.role, entries: [], status: 'out' };
  });

  if (typeof clockEntries !== 'undefined') {
    clockEntries.forEach(e => {
      if (!staffStatus[e.staffId]) {
        staffStatus[e.staffId] = { name: e.staffName, role: '', entries: [], status: 'out' };
      }
      staffStatus[e.staffId].entries.push(e);
    });
  }

  // Determine current status for each staff member
  const rows = Object.entries(staffStatus).map(([id, s]) => {
    const sorted = s.entries.sort((a, b) => new Date(a.time) - new Date(b.time));
    const last = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    const isClockedIn = last && last.type === 'in';

    // Calculate total hours worked today
    let totalMinutes = 0;
    let clockInTime = null;
    sorted.forEach(e => {
      if (e.type === 'in') {
        clockInTime = new Date(e.time);
      } else if (e.type === 'out' && clockInTime) {
        totalMinutes += Math.floor((new Date(e.time) - clockInTime) / 60000);
        clockInTime = null;
      }
    });
    // If still clocked in, add time to now
    if (isClockedIn && clockInTime) {
      totalMinutes += Math.floor((Date.now() - clockInTime) / 60000);
    }

    const hoursStr = totalMinutes > 0
      ? Math.floor(totalMinutes / 60) + 'h ' + (totalMinutes % 60) + 'm'
      : '—';
    const clockInStr = last && last.type === 'in'
      ? new Date(last.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : '';
    const clockOutStr = last && last.type === 'out'
      ? new Date(last.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : '';

    return { id, name: s.name, role: s.role, isClockedIn, hoursStr, clockInStr, clockOutStr, hasEntries: sorted.length > 0 };
  });

  // Sort: clocked in first, then by name
  rows.sort((a, b) => {
    if (a.isClockedIn !== b.isClockedIn) return a.isClockedIn ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Split into clocked in and not
  const clockedIn = rows.filter(r => r.isClockedIn);
  const clockedOut = rows.filter(r => !r.isClockedIn);

  let html = '';

  if (clockedIn.length > 0) {
    html += `<div class="clock-section-label">CLOCKED IN (${clockedIn.length})</div>`;
    html += `<table class="mgmt-table">
      <thead><tr><th>NAME</th><th>ROLE</th><th>IN AT</th><th>HOURS</th><th></th></tr></thead>
      <tbody>
        ${clockedIn.map(r => `<tr>
          <td><span class="clock-dot in"></span> ${r.name}</td>
          <td>${r.role}</td>
          <td>${r.clockInStr}</td>
          <td>${r.hoursStr}</td>
          <td><button class="mgmt-edit-btn" onclick="mgmtForceClockOut('${r.id}')">CLOCK OUT</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  if (clockedOut.length > 0) {
    html += `<div class="clock-section-label" style="margin-top:20px">NOT CLOCKED IN (${clockedOut.length})</div>`;
    html += `<table class="mgmt-table">
      <thead><tr><th>NAME</th><th>ROLE</th><th>LAST OUT</th><th>HOURS TODAY</th></tr></thead>
      <tbody>
        ${clockedOut.map(r => `<tr>
          <td><span class="clock-dot out"></span> ${r.name}</td>
          <td>${r.role}</td>
          <td>${r.clockOutStr || (r.hasEntries ? '' : '<span style="color:var(--ash)">no entry</span>')}</td>
          <td>${r.hoursStr}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  if (rows.length === 0) {
    html = '<div class="mgmt-empty">No staff configured</div>';
  }

  list.innerHTML = html;
}

function mgmtForceClockOut(staffId) {
  const staff = STAFF.find(s => s.id === staffId);
  if (!staff) return;

  // Check for open tabs
  const openTabs = tabs.filter(t =>
    (t.status === 'open' || t.status === 'sent') && t.createdBy === staff.id
  );
  if (openTabs.length > 0) {
    showToast(staff.name + ' has ' + openTabs.length + ' open tab(s) — close first');
    return;
  }

  // Show checkout report then clock out
  if (typeof pendingClockOutStaff !== 'undefined' && typeof showStaffCheckout === 'function') {
    pendingClockOutStaff = staff;
    showStaffCheckout(staff);
    return;
  }

  // Fallback — direct clock out
  if (typeof clockEntries !== 'undefined') {
    clockEntries.push({ staffId: staff.id, staffName: staff.name, type: 'out', time: new Date() });
  }
  renderMgmtClock();
  showToast(staff.name + ' clocked out');
}

// ═══════════════════════════════════════════
// CLOSED CHECKS — reopen, change tip
// ═══════════════════════════════════════════

function renderMgmtChecks() {
  const closed = tabs.filter(t => t.status === 'closed' || t.status === 'paid');
  const staffMap = {};
  STAFF.forEach(s => staffMap[s.id] = s.name);

  const list = document.getElementById('mgmtChecksList');

  if (closed.length === 0) {
    list.innerHTML = '<div class="mgmt-empty">No closed checks</div>';
    return;
  }

  // Most recent first
  const sorted = [...closed].sort((a, b) => new Date(b.closedAt || b.paidAt) - new Date(a.closedAt || a.paidAt));

  list.innerHTML = `
    <table class="mgmt-table">
      <thead><tr><th>CHECK</th><th>SERVER</th><th>METHOD</th><th>TOTAL</th><th>TIP</th><th>CLOSED</th><th></th></tr></thead>
      <tbody>
        ${sorted.map(t => {
          const total = tabTotal(t);
          const time = t.closedAt ? new Date(t.closedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
          return `<tr>
            <td>${t.name}</td>
            <td>${staffMap[t.createdBy] || '—'}</td>
            <td>${(t.payMethod || '—').toUpperCase()}</td>
            <td>$${total.toFixed(2)}</td>
            <td>$${(t.tipAmount || 0).toFixed(2)}</td>
            <td>${time}</td>
            <td>
              <button class="mgmt-edit-btn" onclick="openChangeTip('${t.id}')" style="margin-right:4px">TIP</button>
              ${hasPermission('tab.reopen') ? `<button class="mgmt-edit-btn" onclick="reopenCheck('${t.id}')">REOPEN</button>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function openChangeTip(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const sub = tabSubtotal(tab) - tabDiscountAmount(tab);
  const currentTip = tab.tipAmount || 0;

  document.getElementById('ecPanel').innerHTML = '';
  const modal = document.getElementById('editCheckModal');
  document.querySelector('#editCheckModal .modal-title').textContent = 'CHANGE TIP — ' + tab.name;
  document.querySelector('#editCheckModal .ec-actions').style.display = 'none';

  document.getElementById('ecPanel').innerHTML = `
    <div class="ec-form">
      <div class="ec-subtitle">CURRENT TIP: $${currentTip.toFixed(2)}</div>
      <div class="form-row">
        <label class="form-label">NEW TIP $</label>
        <input type="number" id="changeTipAmount" class="form-input" step="0.01" min="0" value="${currentTip.toFixed(2)}" style="width:120px">
        <button class="mgmt-action-btn" onclick="submitChangeTip('${tabId}')" style="margin-left:8px">SAVE</button>
      </div>
      <div class="ec-discount-btns" style="margin-top:8px">
        <button class="ec-disc-btn" onclick="document.getElementById('changeTipAmount').value=(${sub}*0.18).toFixed(2)">18%</button>
        <button class="ec-disc-btn" onclick="document.getElementById('changeTipAmount').value=(${sub}*0.20).toFixed(2)">20%</button>
        <button class="ec-disc-btn" onclick="document.getElementById('changeTipAmount').value=(${sub}*0.25).toFixed(2)">25%</button>
      </div>
    </div>`;

  openModal('editCheckModal');
}

function submitChangeTip(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const amount = parseFloat(document.getElementById('changeTipAmount').value);
  if (isNaN(amount) || amount < 0) { showToast('Invalid tip amount'); return; }

  const sub = tabSubtotal(tab) - tabDiscountAmount(tab);
  const tipPct = sub > 0 ? amount / sub : 0;

  // Gate: tip over 35% of base requires manager/owner
  if (tipPct > 0.35 && !hasPermission('pay.change_tip')) {
    showToast('Tip over 35% requires manager approval');
    return;
  }

  const oldTip = tab.tipAmount || 0;
  tab.tipAmount = amount;
  tab.tipPct = tipPct;

  closeModal('editCheckModal');
  // Restore edit check modal state
  document.querySelector('#editCheckModal .modal-title').textContent = 'EDIT CHECK';
  document.querySelector('#editCheckModal .ec-actions').style.display = '';

  renderMgmtChecks();
  showToast('Tip updated to $' + amount.toFixed(2));

  // Persist + audit
  if (typeof serverTipAdjust === 'function') serverTipAdjust(tab, amount);
}

async function reopenCheck(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  // Permission gate: live check from Supabase (not cached)
  const perms = currentUser.securityGroupId
    ? await loadPermissions(currentUser.securityGroupId)
    : new Set();

  if (!perms.has('tab.reopen')) {
    showToast('No permission to reopen checks');
    return;
  }

  const hasDeposit = (tab.depositAmount && tab.depositAmount > 0) || tab.bookingId;

  if (hasDeposit && !perms.has('tab.reopen_deposit')) {
    showToast('No permission to reopen deposit checks — requires tab.reopen_deposit');
    return;
  }

  // Store previous payment info before clearing
  tab.previousPayment = {
    method: tab.payMethod,
    total: typeof tabTotal === 'function' ? tabTotal(tab) : 0,
    tip: tab.tipAmount || 0,
    closedAt: tab.closedAt,
    deposit: tab.depositAmount || 0,
  };

  tab.status = 'sent';
  tab.closedAt = null;
  tab.paidAt = null;
  tab.payMethod = null;
  tab.tipPct = 0;
  tab.tipAmount = 0;

  // Restore line statuses
  tab.lines.forEach(l => {
    if (l.status === 'served') l.status = 'sent';
  });

  // Re-fetch booking data (deposit, min spend) from Supabase
  if (tab.bookingId && typeof applyBookingToTab === 'function') {
    await applyBookingToTab(tab, tab.bookingId);
  }

  // Reopen the table session if it was closed
  if (tab.sessionId && tab.tableNum) {
    const { error } = await sb
      .from('table_sessions')
      .update({ status: 'seated', closed_at: null, payment_amount: 0 })
      .eq('id', tab.sessionId);
    if (!error && typeof tableSessions !== 'undefined') {
      tableSessions[tab.tableNum] = { id: tab.sessionId, table_number: tab.tableNum, status: 'seated' };
    }
  }

  activeTabId = tab.id;
  renderTabs();
  renderCart();
  if (typeof updateFloorPlan === 'function') updateFloorPlan();
  switchView('terminal');
  showToast(tab.name + ' reopened — deposit and payments restored');

  // Audit log
  if (typeof serverAuditLog === 'function') {
    serverAuditLog('tab_reopen', {
      order_id: tab.serverId, tab_name: tab.name, order_num: tab.orderNum, station_code: STATION.code,
      previous_payment: tab.previousPayment,
    });
  }
}

// ═══════════════════════════════════════════
// CLOSE DAY
// ═══════════════════════════════════════════

async function renderMgmtDayClose() {
  // Load paid outs from server
  await loadPaidOuts();

  const closedTabs = tabs.filter(t => t.status === 'closed');
  const voidedTabs = tabs.filter(t => t.status === 'voided');
  const openTabs = tabs.filter(t => t.status === 'open' || t.status === 'sent');

  let totalSales = 0, totalTips = 0, cardSales = 0, cashSales = 0, compSales = 0;
  closedTabs.forEach(t => {
    const sub = tabSubtotal(t);
    const tax = tabTax(t);
    totalSales += sub + tax;
    totalTips += t.tipAmount || 0;
    if (t.payMethod === 'card') cardSales += sub + tax;
    if (t.payMethod === 'cash') cashSales += sub + tax;
    if (t.payMethod === 'comp') compSales += sub + tax;
  });

  const netCash = cashSales - paidOutsTotal;

  const el = document.getElementById('mgmtDayClose');
  el.innerHTML = `
    <div class="dayclose-summary">
      <div class="dayclose-row">
        <span>OPEN TABS</span>
        <span class="${openTabs.length > 0 ? 'text-red' : ''}">${openTabs.length}</span>
      </div>
      <div class="dayclose-row">
        <span>CLOSED TABS</span>
        <span>${closedTabs.length}</span>
      </div>
      <div class="dayclose-row">
        <span>VOIDED TABS</span>
        <span>${voidedTabs.length}</span>
      </div>
      <div class="dayclose-divider"></div>
      <div class="dayclose-row">
        <span>CARD SALES</span>
        <span>$${cardSales.toFixed(2)}</span>
      </div>
      <div class="dayclose-row">
        <span>CASH SALES</span>
        <span>$${cashSales.toFixed(2)}</span>
      </div>
      <div class="dayclose-row">
        <span>COMP</span>
        <span>$${compSales.toFixed(2)}</span>
      </div>
      <div class="dayclose-divider"></div>
      <div class="dayclose-row grand">
        <span>TOTAL SALES</span>
        <span>$${totalSales.toFixed(2)}</span>
      </div>
      <div class="dayclose-row">
        <span>TOTAL TIPS</span>
        <span>$${totalTips.toFixed(2)}</span>
      </div>
      <div class="dayclose-row grand">
        <span>GRAND TOTAL</span>
        <span>$${(totalSales + totalTips).toFixed(2)}</span>
      </div>
      <div class="dayclose-divider"></div>
      <div class="dayclose-row" style="color:var(--red)">
        <span>PAID OUTS</span>
        <span>-$${paidOutsTotal.toFixed(2)}</span>
      </div>
      <div class="dayclose-row grand">
        <span>NET CASH</span>
        <span>$${netCash.toFixed(2)}</span>
      </div>
    </div>

    <!-- Paid Outs List -->
    <div style="margin-top:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-family:var(--font-label);font-size:14px;color:var(--gold);letter-spacing:2px">PAID OUTS (${paidOutsList.length})</span>
        <button class="mgmt-action-btn" onclick="openPaidOut()">+ PAID OUT</button>
      </div>
      ${paidOutsList.length === 0
        ? '<div style="color:var(--ash);font-size:14px;padding:12px 0">No paid outs recorded today</div>'
        : `<div style="background:var(--obsidian-mid);border:1px solid var(--surface);border-radius:var(--radius-lg);padding:12px 16px">
            ${paidOutsList.map(po => `
              <div class="po-list-item">
                <div>
                  <div class="po-list-cat">${po.category}</div>
                  ${po.notes ? `<div class="po-list-note">${po.notes}</div>` : ''}
                  <div class="po-list-note">${po.staff_name} &bull; ${new Date(po.recorded_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                </div>
                <div style="display:flex;align-items:center;gap:12px">
                  <span class="po-list-amt">$${parseFloat(po.amount).toFixed(2)}</span>
                  ${hasPermission('mgmt.void') ? `<button class="mgmt-edit-btn" onclick="deletePaidOut('${po.id}')" style="color:var(--red)">X</button>` : ''}
                </div>
              </div>
            `).join('')}
            <div class="po-list-item" style="border-bottom:none;font-family:var(--font-label);color:var(--ivory)">
              <span>TOTAL PAID OUTS</span>
              <span class="po-list-amt">$${paidOutsTotal.toFixed(2)}</span>
            </div>
          </div>`
      }
    </div>

    ${openTabs.length > 0 ? '<div class="dayclose-warning" style="margin-top:20px">Close all open tabs before closing the day</div>' : `
      <div class="form-actions" style="margin-top:20px">
        <button class="mgmt-action-btn" onclick="closeDay()">CLOSE DAY</button>
      </div>
    `}
  `;
}

async function closeDay() {
  // Confirm
  if (!await posConfirm('Close the day and push P&L data to Supabase? This cannot be undone.')) return;

  const result = await serverPost('/api/sessions/close', {
    closed_by: currentUser.id,
    closed_by_name: currentUser.name,
  });

  if (!result) {
    showToast('Day close failed — check server connection');
    return;
  }

  if (result.error) {
    showToast(result.error);
    return;
  }

  const s = result.summary;
  const syncMsg = result.sync.pushed > 0
    ? ` — ${result.sync.pushed} rows pushed to P&L`
    : result.sync.errors.length > 0
      ? ' — P&L sync pending (offline)'
      : '';

  showToast(`Day closed: $${s.net_sales.toFixed(2)} net sales, $${s.paid_outs.toFixed(2)} paid outs${syncMsg}`);

  // Audit log
  if (typeof serverAuditLog === 'function') {
    serverAuditLog('day_close', {
      session_id: result.session.id,
      date: s.date,
      net_sales: s.net_sales,
      total_tips: s.total_tips,
      paid_outs: s.paid_outs,
      cash_deposit: s.cash_deposit,
      rows_pushed: result.sync.pushed,
    });
  }

  // Reset terminal state
  tabs = [];
  activeTabId = null;
  nextTabNum = 1;
  paidOutsList = [];
  paidOutsTotal = 0;
  switchView('terminal');
  renderTabs();
  renderCart();
}
