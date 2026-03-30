/* RIDDIM POS — Management: Operations */
'use strict';

// ═══════════════════════════════════════════
// VIEW SERVERS — staff list with Act As
// ═══════════════════════════════════════════

let _serversSearchTerm = '';

function renderMgmtServers() {
  const myLevel = getRoleLevel(currentUser);
  const search = _serversSearchTerm.toLowerCase();
  const list = document.getElementById('mgmtServersList');

  // Determine who is clocked in
  const clockedInIds = new Set();
  if (typeof clockEntries !== 'undefined') {
    const latestByStaff = {};
    clockEntries.forEach(e => {
      if (!latestByStaff[e.staffId] || new Date(e.time) > new Date(latestByStaff[e.staffId].time)) {
        latestByStaff[e.staffId] = e;
      }
    });
    Object.entries(latestByStaff).forEach(([id, e]) => {
      if (e.type === 'in') clockedInIds.add(id);
    });
  }

  // Only show clocked-in staff below current user's auth level
  const visible = STAFF.filter(s => {
    if (s.id === currentUser.id) return false;
    if (!clockedInIds.has(s.id)) return false;
    const sLevel = getRoleLevel(s);
    if (sLevel >= myLevel) return false;
    if (search && !s.name.toLowerCase().includes(search)) return false;
    return true;
  }).sort((a, b) => getRoleLevel(b) - getRoleLevel(a));

  // Search bar
  let html = `<div style="margin-bottom:12px"><input type="text" placeholder="Search staff..." value="${_serversSearchTerm}"
    oninput="_serversSearchTerm=this.value;renderMgmtServers()" style="width:100%;height:36px;padding:0 10px;border:1px solid var(--surface);border-radius:var(--radius);background:var(--obsidian-mid);color:var(--ivory);font-size:13px;outline:none;"></div>`;

  if (visible.length === 0) {
    list.innerHTML = html + '<div class="mgmt-empty">No clocked-in staff below your clearance level</div>';
    return;
  }

  html += visible.map(s => {
    const level = getRoleLevel(s);
    const groupName = s.groupName || 'unassigned';
    const openTabs = tabs.filter(t => t.createdBy === s.id && (t.status === 'open' || t.status === 'sent'));
    const closedTabs = tabs.filter(t => t.createdBy === s.id && (t.status === 'closed' || t.status === 'paid'));
    const totalSales = openTabs.reduce((sum, t) => sum + tabTotal(t), 0);

    return `
      <div class="server-card">
        <div class="server-card-header" style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <span class="server-card-name">${s.name}</span>
            <span style="font-size:11px;color:var(--ash);margin-left:8px;">L${level} ${groupName}</span>
          </div>
          <button onclick="enterActAs('${s.id}')" style="background:var(--gold);color:var(--obsidian);border:none;border-radius:4px;padding:5px 14px;font-family:var(--font-label);font-size:12px;letter-spacing:0.1em;cursor:pointer;">ACT AS</button>
        </div>
        <div class="server-card-stat" style="padding:0 12px 4px;font-size:12px;color:var(--ash);">
          ${openTabs.length} open tab${openTabs.length !== 1 ? 's' : ''} — $${totalSales.toFixed(2)} | ${closedTabs.length} closed
        </div>
        ${openTabs.length > 0 ? `<div class="server-card-tabs">
          ${openTabs.map(t => `
            <div class="server-tab-row" onclick="mgmtSelectTab('${t.id}')">
              <span>${t.name}</span>
              <span>$${tabTotal(t).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>` : ''}
      </div>
    `;
  }).join('');

  list.innerHTML = html;
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
  const myLevel = getRoleLevel(currentUser);

  // Build per-staff status from clockEntries — only staff below current user's level
  const staffStatus = {};
  STAFF.forEach(s => {
    if (getRoleLevel(s) >= myLevel && s.id !== currentUser.id) return;
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

let _checksSearchTerm = '';

function renderMgmtChecks() {
  const closed = getVisibleTabs(['closed', 'paid']);
  const staffMap = {};
  STAFF.forEach(s => staffMap[s.id] = s.name);

  const search = _checksSearchTerm.toLowerCase();

  const list = document.getElementById('mgmtChecksList');

  const filtered = search
    ? closed.filter(t => t.name.toLowerCase().includes(search) || (staffMap[t.createdBy] || '').toLowerCase().includes(search) || (t.payMethod || '').toLowerCase().includes(search))
    : closed;

  const searchHtml = `<div style="margin-bottom:12px"><input type="text" placeholder="Search by name, server, or method..." value="${_checksSearchTerm}"
    oninput="_checksSearchTerm=this.value;renderMgmtChecks()" style="width:100%;height:36px;padding:0 10px;border:1px solid var(--surface);border-radius:var(--radius);background:var(--obsidian-mid);color:var(--ivory);font-size:13px;outline:none;"></div>`;

  if (filtered.length === 0) {
    list.innerHTML = searchHtml + '<div class="mgmt-empty">No closed checks</div>';
    return;
  }

  // Most recent first
  const sorted = [...filtered].sort((a, b) => new Date(b.closedAt || b.paidAt) - new Date(a.closedAt || a.paidAt));

  list.innerHTML = searchHtml + `
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

    <!-- Cash Deposit -->
    <div style="margin-top:20px;background:var(--obsidian-mid);border:1px solid var(--surface);border-radius:var(--radius-lg);padding:16px">
      <div style="font-family:var(--font-label);font-size:14px;color:var(--gold);letter-spacing:2px;margin-bottom:12px">CASH DEPOSIT</div>
      <div style="display:flex;align-items:center;gap:12px">
        <label style="font-family:var(--font-label);font-size:12px;color:var(--ash);letter-spacing:1px;white-space:nowrap">COUNTED CASH $</label>
        <input type="number" id="closeDayCashDeposit" step="0.01" min="0" placeholder="0.00"
               style="width:140px;height:40px;padding:0 10px;border:1px solid var(--surface);border-radius:var(--radius);background:var(--obsidian);color:var(--ivory);font-size:18px;font-family:var(--font-body)">
      </div>
    </div>

    <!-- Settle Credit Cards (placeholder) -->
    <div style="margin-top:16px;background:var(--obsidian-mid);border:1px solid var(--surface);border-radius:var(--radius-lg);padding:16px;opacity:0.5">
      <div style="font-family:var(--font-label);font-size:14px;color:var(--gold);letter-spacing:2px;margin-bottom:8px">SETTLE CREDIT CARDS</div>
      <div style="font-size:13px;color:var(--ash)">Merchant processor not active. Card settlement will be configured when Stripe Terminal is connected.</div>
    </div>

    ${openTabs.length > 0 ? '<div class="dayclose-warning" style="margin-top:20px">Close all open tabs before closing the day</div>' : `
      <div class="form-actions" style="margin-top:20px">
        <button class="mgmt-action-btn" onclick="closeDay()">CLOSE DAY</button>
      </div>
    `}
  `;
}

function updateCashDifference() {
  const input = document.getElementById('closeDayCashDeposit');
  const display = document.getElementById('cashDiffDisplay');
  if (!input || !display) return;
  const counted = parseFloat(input.value) || 0;
  // Get expected from the NET CASH row
  const closedTabs = tabs.filter(t => t.status === 'closed');
  let cashSales = 0;
  closedTabs.forEach(t => {
    if (t.payMethod === 'cash') cashSales += tabSubtotal(t) + tabTax(t);
  });
  const expected = cashSales - paidOutsTotal;
  const diff = counted - expected;
  if (Math.abs(diff) < 0.01) {
    display.textContent = '';
  } else if (diff > 0) {
    display.textContent = '$' + diff.toFixed(2) + ' OVER';
    display.style.color = 'var(--green)';
  } else {
    display.textContent = '$' + Math.abs(diff).toFixed(2) + ' SHORT';
    display.style.color = 'var(--red)';
  }
}

async function closeDay() {
  // Confirm
  if (!await posConfirm('Close the day? This will finalize all sales data and cannot be undone.')) return;

  const cashDeposit = parseFloat(document.getElementById('closeDayCashDeposit')?.value) || 0;

  const result = await serverPost('/api/sessions/close', {
    closed_by: currentUser.id,
    closed_by_name: currentUser.name,
    cash_deposit: cashDeposit,
  });

  if (!result) {
    showToast('Close day cannot be completed at this time');
    return;
  }

  if (result.error) {
    showToast(result.error);
    return;
  }

  const s = result.summary;
  const syncMsg = result.sync.pushed > 0
    ? ' — P&L data exported'
    : result.sync.errors.length > 0
      ? ' — P&L export pending'
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

// ═══════════════════════════════════════════
// STAFF MANAGEMENT — view by name, edit tabs,
// run checkout, clock out with tip declaration
// ═══════════════════════════════════════════

function renderMgmtStaffManage() {
  const list = document.getElementById('mgmtStaffManageList');
  const myLevel = getRoleLevel(currentUser);

  // Staff at or below current user's role level (never higher)
  const manageable = STAFF.filter(s =>
    s.id !== currentUser.id && getRoleLevel(s) < myLevel
  );

  // Determine who is clocked in
  const clockedInIds = new Set();
  if (typeof clockEntries !== 'undefined') {
    const latestByStaff = {};
    clockEntries.forEach(e => {
      if (!latestByStaff[e.staffId] || new Date(e.time) > new Date(latestByStaff[e.staffId].time)) {
        latestByStaff[e.staffId] = e;
      }
    });
    Object.entries(latestByStaff).forEach(([id, e]) => {
      if (e.type === 'in') clockedInIds.add(id);
    });
  }

  const clockedIn = manageable.filter(s => clockedInIds.has(s.id));
  const notClockedIn = manageable.filter(s => !clockedInIds.has(s.id));

  if (manageable.length === 0) {
    list.innerHTML = '<div class="mgmt-empty">No staff to manage</div>';
    return;
  }

  let html = '';

  if (clockedIn.length > 0) {
    html += `<div class="clock-section-label">CLOCKED IN (${clockedIn.length})</div>`;
    html += `<table class="mgmt-table">
      <thead><tr><th>NAME</th><th>ROLE</th><th>OPEN TABS</th><th>CLOSED</th><th></th></tr></thead>
      <tbody>
        ${clockedIn.map(s => {
          const openCount = tabs.filter(t => t.createdBy === s.id && (t.status === 'open' || t.status === 'sent')).length;
          const closedCount = tabs.filter(t => t.createdBy === s.id && (t.status === 'closed' || t.status === 'paid')).length;
          return `<tr>
            <td><span class="clock-dot in"></span> ${s.name}</td>
            <td>${s.role}</td>
            <td>${openCount || '—'}</td>
            <td>${closedCount || '—'}</td>
            <td>
              <button class="mgmt-edit-btn" onclick="staffManageSelect('${s.id}')" style="margin-right:4px">MANAGE</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  if (notClockedIn.length > 0) {
    html += `<div class="clock-section-label" style="margin-top:20px">NOT CLOCKED IN (${notClockedIn.length})</div>`;
    html += `<table class="mgmt-table">
      <thead><tr><th>NAME</th><th>ROLE</th><th>OPEN TABS</th><th>CLOSED</th><th></th></tr></thead>
      <tbody>
        ${notClockedIn.map(s => {
          const openCount = tabs.filter(t => t.createdBy === s.id && (t.status === 'open' || t.status === 'sent')).length;
          const closedCount = tabs.filter(t => t.createdBy === s.id && (t.status === 'closed' || t.status === 'paid')).length;
          return `<tr>
            <td><span class="clock-dot out"></span> ${s.name}</td>
            <td>${s.role}</td>
            <td>${openCount || '—'}</td>
            <td>${closedCount || '—'}</td>
            <td>
              ${openCount > 0 || closedCount > 0 ? `<button class="mgmt-edit-btn" onclick="staffManageSelect('${s.id}')">MANAGE</button>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  list.innerHTML = html;
}

function staffManageSelect(staffId) {
  const staff = STAFF.find(s => s.id === staffId);
  if (!staff) return;

  const list = document.getElementById('mgmtStaffManageList');
  const openTabs = tabs.filter(t => t.createdBy === staff.id && (t.status === 'open' || t.status === 'sent'));
  const closedTabs = tabs.filter(t => t.createdBy === staff.id && (t.status === 'closed' || t.status === 'paid'));

  // Check if clocked in
  let isClockedIn = false;
  if (typeof clockEntries !== 'undefined') {
    const last = [...clockEntries].reverse().find(e => e.staffId === staff.id);
    isClockedIn = last && last.type === 'in';
  }

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <span style="font-family:var(--font-label);font-size:18px;color:var(--gold);letter-spacing:2px">${staff.name}</span>
        <span style="font-size:12px;color:var(--ash);margin-left:8px">${staff.role.toUpperCase()}</span>
        ${isClockedIn ? '<span class="clock-dot in" style="margin-left:8px"></span>' : ''}
      </div>
      <button class="mgmt-edit-btn" onclick="renderMgmtStaffManage()">BACK</button>
    </div>`;

  // Open tabs
  if (openTabs.length > 0) {
    html += `<div style="font-family:var(--font-label);font-size:12px;color:var(--gold);letter-spacing:2px;margin-bottom:8px">OPEN TABS (${openTabs.length})</div>`;
    html += `<table class="mgmt-table">
      <thead><tr><th>TAB</th><th>ITEMS</th><th>TOTAL</th><th></th></tr></thead>
      <tbody>
        ${openTabs.map(t => {
          const total = tabSubtotal(t);
          return `<tr>
            <td>${t.name}</td>
            <td>${t.lines.filter(l => !l.voided).length}</td>
            <td>$${total.toFixed(2)}</td>
            <td><button class="mgmt-edit-btn" onclick="mgmtSelectTab('${t.id}')">VIEW</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  } else {
    html += `<div style="color:var(--ash);font-size:14px;margin-bottom:16px">No open tabs</div>`;
  }

  // Closed tabs
  if (closedTabs.length > 0) {
    html += `<div style="font-family:var(--font-label);font-size:12px;color:var(--gold);letter-spacing:2px;margin:16px 0 8px">CLOSED TABS (${closedTabs.length})</div>`;
    html += `<table class="mgmt-table">
      <thead><tr><th>TAB</th><th>METHOD</th><th>TOTAL</th><th>TIP</th></tr></thead>
      <tbody>
        ${closedTabs.sort((a, b) => new Date(b.closedAt || b.paidAt) - new Date(a.closedAt || a.paidAt)).map(t => {
          const total = tabTotal(t);
          return `<tr>
            <td>${t.name}</td>
            <td>${(t.payMethod || '—').toUpperCase()}</td>
            <td>$${total.toFixed(2)}</td>
            <td>$${(t.tipAmount || 0).toFixed(2)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  // Actions
  html += `<div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">`;

  // Checkout report
  html += `<button class="mgmt-action-btn" onclick="staffManageCheckout('${staff.id}')">RUN CHECKOUT</button>`;

  // Clock out with tip declaration (only if clocked in and no open tabs)
  if (isClockedIn && openTabs.length === 0) {
    html += `
      <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
        <label style="font-family:var(--font-label);font-size:11px;color:var(--ash);letter-spacing:1px">DECLARED TIPS $</label>
        <input type="number" id="staffDeclaredTips" step="0.01" min="0" placeholder="0.00"
               style="width:100px;height:36px;padding:0 8px;border:1px solid var(--surface);border-radius:var(--radius);background:var(--obsidian-mid);color:var(--ivory);font-size:14px">
        <button class="mgmt-action-btn" onclick="staffManageClockOut('${staff.id}')" style="background:var(--red);border-color:var(--red)">CLOCK OUT</button>
      </div>`;
  } else if (isClockedIn && openTabs.length > 0) {
    html += `<span style="color:var(--red);font-size:13px;margin-left:auto">Close ${openTabs.length} open tab(s) before clock out</span>`;
  }

  html += `</div>`;
  list.innerHTML = html;
}

function staffManageCheckout(staffId) {
  const staff = STAFF.find(s => s.id === staffId);
  if (!staff) return;
  // Reuse existing checkout report
  pendingClockOutStaff = null; // don't auto clock out
  showStaffCheckout(staff);
}

function staffManageClockOut(staffId) {
  const staff = STAFF.find(s => s.id === staffId);
  if (!staff) return;

  const declaredTips = parseFloat(document.getElementById('staffDeclaredTips')?.value) || 0;

  if (typeof clockEntries !== 'undefined') {
    clockEntries.push({
      staffId: staff.id,
      staffName: staff.name,
      type: 'out',
      time: new Date(),
      declaredTips: declaredTips,
    });
  }

  // Persist to local server
  if (typeof serverClockOut === 'function') serverClockOut(staff.id, declaredTips);

  showToast(`${staff.name} clocked out` + (declaredTips > 0 ? ` — $${declaredTips.toFixed(2)} declared tips` : ''));
  renderMgmtStaffManage();
}
