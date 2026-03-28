const { createReport, finalize, sectionHeader, tableHeader, tableRow, kvRow, spacer, $ } = require('./pdf-renderer');

function generate(data) {
  const { doc, helpers: h } = createReport({
    title: 'Audit Trail',
    dateFrom: data.date_from,
    dateTo: data.date_to,
  });

  // Stats summary
  if (data.stats) {
    sectionHeader(doc, h, 'Summary');
    const s = data.stats;
    if (s.voids) kvRow(doc, h, 'Voids', s.voids.count + ' — ' + $(s.voids.total));
    if (s.comps) kvRow(doc, h, 'Comps', s.comps.count + ' — ' + $(s.comps.total));
    if (s.tab_voids) kvRow(doc, h, 'Tab Voids', s.tab_voids.count + ' — ' + $(s.tab_voids.total));
    if (s.discounts) kvRow(doc, h, 'Discounts', s.discounts.count + ' — ' + $(s.discounts.total));
    if (s.price_overrides) kvRow(doc, h, 'Price Changes', String(s.price_overrides.count));
    if (s.tip_adjusts) kvRow(doc, h, 'Tip Adjustments', String(s.tip_adjusts.count));
    spacer(doc, h, 'rule');
  }

  sectionHeader(doc, h, 'Audit Entries');
  const cols = [
    { label: 'Date/Time', width: 90 },
    { label: 'Type', width: 65 },
    { label: 'Order #', width: 45, align: 'right' },
    { label: 'Item', width: 100 },
    { label: 'Amount', width: 60, align: 'right' },
    { label: 'Reason', width: 80 },
    { label: 'By', width: 64 },
  ];
  tableHeader(doc, h, cols);

  (data.entries || []).forEach((entry, i) => {
    const dt = entry.action_at ? new Date(entry.action_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
    const typeLabel = (entry.audit_type || '').replace(/_/g, ' ').toUpperCase();
    tableRow(doc, h, cols, [
      dt,
      typeLabel,
      String(entry.order_num || ''),
      entry.item_name || '—',
      $(parseFloat(entry.price) * (entry.qty || 1)),
      (entry.reason || '—').substring(0, 25),
      (entry.server_name || entry.action_by || '—').substring(0, 15),
    ], { rowIndex: i });
  });

  finalize(doc);
  return doc;
}

module.exports = { generate };
