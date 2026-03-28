const { createReport, finalize, sectionHeader, tableHeader, tableRow, kvRow, spacer, $ } = require('./pdf-renderer');

function generate(data) {
  const { doc, helpers: h } = createReport({
    title: 'Transaction Report',
    dateFrom: data.date_from,
    dateTo: data.date_to,
  });

  // Summary stats
  if (data.stats) {
    sectionHeader(doc, h, 'Summary');
    kvRow(doc, h, 'Total Transactions', String(data.stats.total || data.transactions.length));
    if (data.stats.total_sales !== undefined) kvRow(doc, h, 'Total Sales', $(data.stats.total_sales));
    if (data.stats.total_tips !== undefined) kvRow(doc, h, 'Total Tips', $(data.stats.total_tips));
    spacer(doc, h, 'rule');
  }

  sectionHeader(doc, h, 'Transactions');
  const cols = [
    { label: 'Date', width: 70 },
    { label: 'Order #', width: 50, align: 'right' },
    { label: 'Employee', width: 90 },
    { label: 'Station', width: 55 },
    { label: 'Amount', width: 70, align: 'right' },
    { label: 'Tip', width: 60, align: 'right' },
    { label: 'Method', width: 55 },
    { label: 'State', width: 54 },
  ];
  tableHeader(doc, h, cols);

  (data.transactions || []).forEach((tx, i) => {
    const date = tx.opened_at ? new Date(tx.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
    tableRow(doc, h, cols, [
      date,
      String(tx.order_num || ''),
      tx.server_name || '—',
      tx.station_code || '—',
      $(tx.pay_amount || tx.total || 0),
      $(tx.tip_amount || 0),
      (tx.method || '—').toUpperCase(),
      (tx.state || '—').toUpperCase(),
    ], { rowIndex: i });
  });

  finalize(doc);
  return doc;
}

module.exports = { generate };
