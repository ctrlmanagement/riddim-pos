/**
 * RIDDIM POS — Paid Out Summary PDF
 */

const { createReport, finalize, sectionHeader, tableHeader, tableRow, kvRow, $ } = require('./pdf-renderer');

function generate(data) {
  const d = data;
  const { doc, helpers: h } = createReport({
    title: 'Paid Out Summary',
    dateFrom: d.date_from,
    dateTo: d.date_to,
  });

  if (d.categories.length === 0) {
    kvRow(doc, h, 'No paid outs recorded', '');
    finalize(doc);
    return doc;
  }

  // Group details by category
  const grouped = {};
  d.details.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  const detailCols = [
    { label: 'Amount', width: 100, align: 'right' },
    { label: 'Notes', width: 200, align: 'left' },
    { label: 'Staff', width: 104, align: 'left' },
    { label: 'Time', width: 100, align: 'right' },
  ];

  d.categories.forEach(cat => {
    sectionHeader(doc, h, cat.category);
    tableHeader(doc, h, detailCols);

    const items = grouped[cat.category] || [];
    items.forEach((item, i) => {
      const timeStr = new Date(item.recorded_at).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
      tableRow(doc, h, detailCols, [
        $(item.amount),
        item.notes || '—',
        item.staff_name,
        timeStr,
      ], { rowIndex: i });
    });

    tableRow(doc, h, detailCols, [
      $(cat.total), '', '', `(${cat.count} entries)`,
    ], { isTotal: true });
  });

  // Grand total
  sectionHeader(doc, h, 'Total');
  kvRow(doc, h, 'Total Paid Outs', $(d.grand_total), { isTotal: true });

  finalize(doc);
  return doc;
}

module.exports = { generate };
