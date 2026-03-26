/* RIDDIM POS — Member Lookup Module
   Phone-based member search at tab creation
   Constraint #5: Phone lookup must use .ilike('phone', '%<10digits>%')
   S79: RIDDIM integration layer */

'use strict';

// ═══════════════════════════════════════════
// MEMBER TIER CALCULATION (not stored — derived from points)
// ═══════════════════════════════════════════

function getMemberTier(points) {
  if (points >= 5000) return { name: 'Obsidian', color: '#0A0A0A', border: '#D4A843' };
  if (points >= 1000) return { name: 'Gold', color: '#D4A843', border: '#D4A843' };
  return { name: 'Silver', color: '#888888', border: '#888888' };
}

// ═══════════════════════════════════════════
// MEMBER SEARCH — phone-based lookup
// ═══════════════════════════════════════════

let memberSearchResults = [];
let memberSearchTimeout = null;

function openMemberLookup() {
  memberSearchResults = [];
  const input = document.getElementById('memberSearchInput');
  if (input) input.value = '';
  const results = document.getElementById('memberSearchResults');
  if (results) results.innerHTML = '<div class="member-search-hint">Enter phone number to search</div>';
  openModal('memberLookupModal');
  setTimeout(() => { if (input) input.focus(); }, 100);
}

function memberSearchKeyup(e) {
  const raw = document.getElementById('memberSearchInput').value.replace(/\D/g, '');

  // Debounce — wait 300ms after last keypress
  clearTimeout(memberSearchTimeout);
  if (raw.length < 4) {
    document.getElementById('memberSearchResults').innerHTML =
      '<div class="member-search-hint">Enter at least 4 digits</div>';
    return;
  }

  memberSearchTimeout = setTimeout(() => searchMembers(raw), 300);
}

async function searchMembers(digits) {
  const results = document.getElementById('memberSearchResults');
  results.innerHTML = '<div class="member-search-hint">Searching...</div>';

  // Constraint #5: phone lookup uses .ilike, not .eq
  const { data, error } = await sb
    .from('members')
    .select('id, first_name, last_name, phone, total_points, status, visit_count, last_visit_date')
    .ilike('phone', '%' + digits + '%')
    .eq('status', 'active')
    .limit(10);

  if (error) {
    console.error('Member search error:', error);
    results.innerHTML = '<div class="member-search-hint">Search failed</div>';
    return;
  }

  memberSearchResults = data || [];

  if (memberSearchResults.length === 0) {
    results.innerHTML = '<div class="member-search-hint">No members found</div>';
    return;
  }

  results.innerHTML = memberSearchResults.map(m => {
    const tier = getMemberTier(m.total_points || 0);
    const visits = m.visit_count || 0;
    const lastVisit = m.last_visit_date
      ? new Date(m.last_visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'never';
    return `<div class="member-result" onclick="selectMember('${m.id}')">
      <div class="member-result-main">
        <span class="member-result-name">${m.first_name} ${m.last_name || ''}</span>
        <span class="member-tier-badge" style="border-color:${tier.border};color:${tier.color}">${tier.name}</span>
      </div>
      <div class="member-result-meta">
        ${formatPhone(m.phone)} — ${m.total_points || 0} pts — ${visits} visits — last: ${lastVisit}
      </div>
    </div>`;
  }).join('');
}

function formatPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
  }
  if (digits.length === 11 && digits[0] === '1') {
    return '(' + digits.slice(1, 4) + ') ' + digits.slice(4, 7) + '-' + digits.slice(7);
  }
  return phone;
}

async function selectMember(memberId) {
  const member = memberSearchResults.find(m => m.id === memberId);
  if (!member) return;

  closeModal('memberLookupModal');

  // Create a new member tab
  const tier = getMemberTier(member.total_points || 0);
  const name = member.first_name + (member.last_name ? ' ' + member.last_name.charAt(0) + '.' : '');
  const tab = await createTab(name, 'member');
  tab.memberId = member.id;
  tab.memberName = member.first_name + ' ' + (member.last_name || '');
  tab.memberPhone = member.phone;
  tab.memberTier = tier.name;
  tab.memberPoints = member.total_points || 0;
  tab.guestPhone = member.phone;

  renderTabs();
  renderCart();
  showToast('Member: ' + member.first_name + ' — ' + tier.name);
}

// ═══════════════════════════════════════════
// MEMBER LOOKUP BY ID (for reservation flow)
// ═══════════════════════════════════════════

async function lookupMemberById(memberId) {
  if (!memberId) return null;

  const { data, error } = await sb
    .from('members')
    .select('id, first_name, last_name, phone, total_points, status')
    .eq('id', memberId)
    .single();

  if (error || !data) return null;

  const tier = getMemberTier(data.total_points || 0);
  data.tier = tier.name;
  return data;
}

// ═══════════════════════════════════════════
// MEMBER INFO DISPLAY IN CART
// ═══════════════════════════════════════════

function renderMemberBadge(tab) {
  if (!tab || !tab.memberId) return '';

  const tier = getMemberTier(tab.memberPoints || 0);
  return `<div class="cart-member-badge">
    <span class="member-tier-dot" style="background:${tier.color}"></span>
    <span class="cart-member-name">${tab.memberName || 'Member'}</span>
    <span class="cart-member-tier" style="color:${tier.color}">${tier.name} — ${tab.memberPoints || 0} pts</span>
  </div>`;
}
