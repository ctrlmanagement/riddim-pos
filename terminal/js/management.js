/* RIDDIM POS — Management Router */
'use strict';

// ═══════════════════════════════════════════
// VIEW SWITCHING (Terminal <-> Management)
// ═══════════════════════════════════════════

function switchView(view) {
  const terminalBody = document.querySelector('.main-body');
  const tablesPanel = document.getElementById('tablesPanel');
  const mgmtPanel = document.getElementById('managementPanel');
  const navTables = document.getElementById('navTables');
  const navTerminal = document.getElementById('navTerminal');
  const navManagement = document.getElementById('navManagement');

  // Hide all
  terminalBody.style.display = 'none';
  tablesPanel.classList.remove('active');
  mgmtPanel.style.display = 'none';
  navTables.classList.remove('active');
  navTerminal.classList.remove('active');
  navManagement.classList.remove('active');

  if (view === 'tables') {
    tablesPanel.classList.add('active');
    navTables.classList.add('active');
    updateFloorPlan();
  } else if (view === 'management') {
    mgmtPanel.style.display = 'flex';
    navManagement.classList.add('active');
    renderMgmtMenu();
  } else {
    terminalBody.style.display = 'flex';
    navTerminal.classList.add('active');
  }
}

function switchMgmt(section) {
  document.querySelectorAll('.mgmt-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.mgmt-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mgmt-' + section).classList.add('active');
  document.querySelector(`.mgmt-nav-btn[data-mgmt="${section}"]`).classList.add('active');

  // Render the section
  if (section === 'menu') renderMgmtMenu();
  if (section === 'categories') renderMgmtCategories();
  if (section === 'staff') renderMgmtStaff();
  if (section === 'stations') renderMgmtStations();
  if (section === 'reports') renderReport('summary');
  if (section === 'servers') renderMgmtServers();
  if (section === 'clock') renderMgmtClock();
  if (section === 'checks') renderMgmtChecks();
  if (section === 'settings') renderMgmtSettings();
  if (section === 'dayclose') renderMgmtDayClose();
}

// Show management nav based on permissions
function updateManagementAccess() {
  const navBtn = document.getElementById('navManagement');
  if (currentUser && hasPermission('mgmt.access')) {
    navBtn.style.display = '';
  } else {
    navBtn.style.display = 'none';
  }
}
