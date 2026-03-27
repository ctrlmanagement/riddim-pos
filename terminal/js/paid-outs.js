/* RIDDIM POS — Paid Outs */
'use strict';

// Categories matching HotSauce → daily_payouts labels
const PAIDOUT_CATEGORIES = [
  'Security', 'Security #2', 'Police', 'Shift Pay', 'Shift Pay #2',
  'Barbacks', 'Sweeps', 'Hookah Staff', 'Incidentals/Supplies',
  'Cashier', 'DJ Opening', 'DJ Closing', 'Promoters', 'Cleaning',
  'Host Table', 'Table Percentage', 'Manager', 'Manager #2',
  'Kitchen', 'VIP Host', 'Photo',
];

// State for the paid out flow
let poAmount = '';   // string of digits (no decimal yet)
let poCategory = '';
let poNotes = '';
let poStep = 1;      // 1=amount, 2=category, 3=notes/confirm

// Today's paid outs (loaded from server)
let paidOutsList = [];
let paidOutsTotal = 0;

// ═══════════════════════════════════════════
// OPEN PAID OUT MODAL
// ═══════════════════════════════════════════

function openPaidOut() {
  poAmount = '';
  poCategory = '';
  poNotes = '';
  poStep = 1;
  renderPaidOutStep();
  openModal('paidOutModal');
}

// ═══════════════════════════════════════════
// STEP RENDERING
// ═══════════════════════════════════════════

function renderPaidOutStep() {
  const body = document.getElementById('paidOutBody');

  if (poStep === 1) {
    body.innerHTML = renderPOAmountStep();
  } else if (poStep === 2) {
    body.innerHTML = renderPOCategoryStep();
  } else if (poStep === 3) {
    body.innerHTML = renderPOConfirmStep();
  }
}

function renderPOAmountStep() {
  const display = poAmount.length === 0 ? '$0.00'
    : '$' + (parseInt(poAmount) / 100).toFixed(2);

  return `
    <div class="po-step-title">STEP 1 — ENTER AMOUNT</div>
    <div class="po-amount-display">${display}</div>
    <div class="po-numpad">
      <button onclick="poNumKey('1')">1</button>
      <button onclick="poNumKey('2')">2</button>
      <button onclick="poNumKey('3')">3</button>
      <button onclick="poNumKey('4')">4</button>
      <button onclick="poNumKey('5')">5</button>
      <button onclick="poNumKey('6')">6</button>
      <button onclick="poNumKey('7')">7</button>
      <button onclick="poNumKey('8')">8</button>
      <button onclick="poNumKey('9')">9</button>
      <button class="po-clear" onclick="poNumKey('clear')">CLEAR</button>
      <button onclick="poNumKey('0')">0</button>
      <button class="po-back" onclick="poNumKey('back')">&larr;</button>
    </div>
    <div class="po-actions">
      <button class="mgmt-action-btn" onclick="closeModal('paidOutModal')">CANCEL</button>
      <button class="mgmt-action-btn" onclick="poNextStep()" ${poAmount.length === 0 ? 'disabled style="opacity:0.4"' : ''}>NEXT</button>
    </div>
  `;
}

function renderPOCategoryStep() {
  const display = '$' + (parseInt(poAmount) / 100).toFixed(2);

  return `
    <div class="po-step-title">STEP 2 — SELECT CATEGORY &nbsp; (${display})</div>
    <div class="po-categories">
      ${PAIDOUT_CATEGORIES.map(c => `
        <button class="po-cat-btn ${poCategory === c ? 'selected' : ''}"
                onclick="poSelectCategory('${c.replace(/'/g, "\\'")}')">${c}</button>
      `).join('')}
    </div>
    <div class="po-actions" style="margin-top:12px">
      <button class="mgmt-action-btn" onclick="poPrevStep()">BACK</button>
    </div>
  `;
}

function renderPOConfirmStep() {
  const amountNum = parseInt(poAmount) / 100;
  const display = '$' + amountNum.toFixed(2);

  return `
    <div class="po-step-title">STEP 3 — CONFIRM PAID OUT</div>
    <div style="background:var(--obsidian-mid);border:1px solid var(--surface);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px">
      <div class="po-confirm-row total">
        <span>AMOUNT</span>
        <span>${display}</span>
      </div>
      <div class="po-confirm-row">
        <span>CATEGORY</span>
        <span>${poCategory}</span>
      </div>
      <div class="po-confirm-row">
        <span>STAFF</span>
        <span>${currentUser ? currentUser.name : '—'}</span>
      </div>
    </div>
    <textarea class="po-notes-input" id="poNotesInput" placeholder="Notes (optional)">${poNotes}</textarea>
    <div class="po-actions">
      <button class="mgmt-action-btn" onclick="poPrevStep()">BACK</button>
      <button class="mgmt-action-btn" onclick="submitPaidOut()" style="background:var(--green);border-color:var(--green);color:white">SUBMIT</button>
    </div>
  `;
}

// ═══════════════════════════════════════════
// NUMPAD HANDLERS
// ═══════════════════════════════════════════

function poNumKey(key) {
  if (key === 'clear') {
    poAmount = '';
  } else if (key === 'back') {
    poAmount = poAmount.slice(0, -1);
  } else {
    // Max 8 digits (999,999.99)
    if (poAmount.length < 8) poAmount += key;
  }
  renderPaidOutStep();
}

function poNextStep() {
  if (poStep === 1 && poAmount.length > 0) {
    poStep = 2;
  } else if (poStep === 2 && poCategory) {
    poStep = 3;
  }
  renderPaidOutStep();
}

function poPrevStep() {
  if (poStep > 1) poStep--;
  renderPaidOutStep();
}

function poSelectCategory(cat) {
  poCategory = cat;
  poStep = 3;
  renderPaidOutStep();
}

// ═══════════════════════════════════════════
// SUBMIT
// ═══════════════════════════════════════════

async function submitPaidOut() {
  const notesEl = document.getElementById('poNotesInput');
  poNotes = notesEl ? notesEl.value.trim() : '';

  const amountNum = parseInt(poAmount) / 100;
  if (amountNum <= 0) { showToast('Invalid amount'); return; }

  const payload = {
    category: poCategory,
    amount: amountNum,
    notes: poNotes || null,
    staff_id: currentUser.id,
    staff_name: currentUser.name,
    station_code: STATION ? STATION.code : null,
  };

  const result = await serverPost('/api/paid-outs', payload);
  if (!result) {
    showToast('Failed to save paid out');
    return;
  }

  closeModal('paidOutModal');
  showToast('Paid out recorded: $' + amountNum.toFixed(2) + ' — ' + poCategory);

  // Refresh the paid outs list
  await loadPaidOuts();
  renderMgmtDayClose();

  // Audit log
  if (typeof serverAuditLog === 'function') {
    serverAuditLog('paid_out', {
      paid_out_id: result.id,
      category: poCategory,
      amount: amountNum,
      notes: poNotes,
    });
  }
}

// ═══════════════════════════════════════════
// LOAD PAID OUTS (for day close display)
// ═══════════════════════════════════════════

async function loadPaidOuts() {
  const today = new Date().toISOString().slice(0, 10);
  const result = await serverGet('/api/paid-outs?date=' + today);
  if (result) {
    paidOutsList = result.paid_outs || [];
    paidOutsTotal = result.total || 0;
  }
}

async function deletePaidOut(id) {
  const result = await serverDelete('/api/paid-outs/' + id);
  if (!result) {
    showToast('Failed to delete paid out');
    return;
  }
  showToast('Paid out removed');
  await loadPaidOuts();
  renderMgmtDayClose();
}

// Helper — serverDelete follows same pattern as serverPost/serverGet
async function serverDelete(path) {
  if (!SERVER_URL) return null;
  try {
    const res = await fetch(SERVER_URL + path, { method: 'DELETE' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}
