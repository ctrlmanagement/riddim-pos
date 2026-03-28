const { createReport, finalize, sectionHeader, tableHeader, tableRow, kvRow, spacer, $ } = require('./pdf-renderer');

function generateSummary(data) {
  const { doc, helpers: h } = createReport({ title: 'Sales Summary', dateFrom: data.date_from, dateTo: data.date_to });

  sectionHeader(doc, h, 'Sales Overview');
  kvRow(doc, h, 'Gross Sales', $(data.gross_sales));
  kvRow(doc, h, 'Net Sales', $(data.net_sales));
  kvRow(doc, h, 'Tax', $(data.tax));
  kvRow(doc, h, 'Tips', $(data.tips));
  kvRow(doc, h, 'Checks Closed', String(data.checks_closed));
  kvRow(doc, h, 'Average Check', $(data.avg_check));
  kvRow(doc, h, 'Comps', $(data.comp_amount) + ' (' + data.comp_items + ' items)');
  kvRow(doc, h, 'Voided Checks', String(data.checks_voided));
  spacer(doc, h, 'rule');

  sectionHeader(doc, h, 'Payment Breakdown');
  const cols = [
    { label: 'Method', width: 126 },
    { label: 'Checks', width: 126, align: 'right' },
    { label: 'Sales', width: 126, align: 'right' },
    { label: 'Tips', width: 126, align: 'right' },
  ];
  tableHeader(doc, h, cols);
  tableRow(doc, h, cols, ['Card', String(data.card.count), $(data.card.sales), $(data.card.tips)], { rowIndex: 0 });
  tableRow(doc, h, cols, ['Cash', String(data.cash.count), $(data.cash.sales), $(data.cash.tips)], { rowIndex: 1 });
  tableRow(doc, h, cols, ['Comp', String(data.comp.count), $(data.comp.sales), '—'], { rowIndex: 2 });

  finalize(doc);
  return doc;
}

function generateProductMix(data) {
  const { doc, helpers: h } = createReport({ title: 'Product Mix', dateFrom: data.date_from, dateTo: data.date_to });

  sectionHeader(doc, h, 'Product Mix');
  const cols = [
    { label: 'Item', width: 180 },
    { label: 'Qty', width: 60, align: 'right' },
    { label: 'Revenue', width: 100, align: 'right' },
    { label: '% Mix', width: 80, align: 'right' },
    { label: 'Comps', width: 42, align: 'right' },
    { label: 'Voids', width: 42, align: 'right' },
  ];
  tableHeader(doc, h, cols);
  (data.items || []).forEach((item, i) => {
    tableRow(doc, h, cols, [item.name, String(item.qty), $(item.revenue), item.pct.toFixed(1) + '%', String(item.comped_qty || ''), String(item.voided_qty || '')], { rowIndex: i });
  });
  tableRow(doc, h, cols, ['Total', '', $(data.total_revenue), '', '', ''], { isTotal: true });

  finalize(doc);
  return doc;
}

function generateEmployee(data) {
  const { doc, helpers: h } = createReport({ title: 'Employee Report', dateFrom: data.date_from, dateTo: data.date_to });

  sectionHeader(doc, h, 'Employee Performance');
  const cols = [
    { label: 'Server', width: 120 },
    { label: 'Tabs', width: 60, align: 'right' },
    { label: 'Items', width: 60, align: 'right' },
    { label: 'Sales', width: 84, align: 'right' },
    { label: 'Tips', width: 70, align: 'right' },
    { label: 'Hours', width: 60, align: 'right' },
    { label: '$/Hour', width: 50, align: 'right' },
  ];
  tableHeader(doc, h, cols);
  (data.employees || []).forEach((e, i) => {
    const perHour = e.hours > 0 ? e.sales / e.hours : 0;
    tableRow(doc, h, cols, [e.server_name, String(e.tabs), String(e.items), $(e.sales), $(e.tips), e.hours > 0 ? e.hours.toFixed(1) + 'h' : '—', perHour > 0 ? '$' + perHour.toFixed(0) : '—'], { rowIndex: i });
  });

  finalize(doc);
  return doc;
}

function generateHourly(data) {
  const { doc, helpers: h } = createReport({ title: 'Hourly Sales', dateFrom: data.date_from, dateTo: data.date_to });

  sectionHeader(doc, h, 'Hourly Breakdown');
  const cols = [
    { label: 'Hour', width: 126 },
    { label: 'Tabs', width: 126, align: 'right' },
    { label: 'Items', width: 126, align: 'right' },
    { label: 'Sales', width: 126, align: 'right' },
  ];
  tableHeader(doc, h, cols);
  (data.hours || []).forEach((hr, i) => {
    tableRow(doc, h, cols, [hr.label, String(hr.tabs), String(hr.items), $(hr.sales)], { rowIndex: i });
  });

  finalize(doc);
  return doc;
}

function generateStation(data) {
  const { doc, helpers: h } = createReport({ title: 'Station Report', dateFrom: data.date_from, dateTo: data.date_to });

  sectionHeader(doc, h, 'Station Breakdown');
  const cols = [
    { label: 'Station', width: 126 },
    { label: 'Tabs', width: 95, align: 'right' },
    { label: 'Items', width: 95, align: 'right' },
    { label: 'Sales', width: 95, align: 'right' },
    { label: 'Tips', width: 93, align: 'right' },
  ];
  tableHeader(doc, h, cols);
  (data.stations || []).forEach((s, i) => {
    tableRow(doc, h, cols, [s.station, String(s.tabs), String(s.items), $(s.sales), $(s.tips)], { rowIndex: i });
  });

  finalize(doc);
  return doc;
}

module.exports = { generateSummary, generateProductMix, generateEmployee, generateHourly, generateStation };
