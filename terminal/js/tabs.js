/* RIDDIM POS — Tab Management */
'use strict';

// ═══════════════════════════════════════════
// TAB MANAGEMENT
// ═══════════════════════════════════════════

async function createTab(name, type = 'bar') {
  const num = nextTabNum++;
  const tab = {
    id: 'tab-' + Date.now(),
    num: num,
    name: name || 'Tab ' + num,
    type: type,
    memberId: null,
    tableNum: null,
    discount: false,
    discountPct: 0,
    discountFlat: 0,
    discountBy: null,
    autoGrat: 0,
    guestCount: 1,
    lines: [],
    status: 'open',
    createdAt: new Date(),
    createdBy: currentUser.id,
    station: STATION.code,
  };
  tabs.push(tab);
  activeTabId = tab.id;
  renderTabs();
  renderCart();
  closeModal('newTabModal');

  // Persist to local server — must await so serverId is set before lines are added
  if (typeof serverCreateOrder === 'function') await serverCreateOrder(tab);

  return tab;
}

function selectTab(tabId) {
  activeTabId = tabId;
  renderTabs();
  renderCart();
}

function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

function renderTabs() {
  const strip = document.getElementById('tabStrip');
  const openTabs = tabs.filter(t => t.status === 'open' || t.status === 'sent');
  strip.innerHTML = openTabs.map(t => {
    const total = tabSubtotal(t);
    return `<div class="tab-chip ${t.id === activeTabId ? 'active' : ''}"
                onclick="selectTab('${t.id}')">
      <span>${t.name}</span>
      ${total > 0 ? `<span class="tab-total">$${total.toFixed(0)}</span>` : ''}
    </div>`;
  }).join('') +
  `<div class="new-tab-btn" onclick="openNewTabModal()">+</div>`;
}
