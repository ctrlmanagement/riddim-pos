/**
 * RIDDIM POS — Server Checkout PDF
 */

const { createReport, finalize, sectionHeader, tableHeader, tableRow, kvRow, spacer, $ } = require('./pdf-renderer');

function generate(data) {
  const d = data;
  const { doc, helpers: h } = createReport({
    title: `Server Checkout — ${d.staff_name}`,
    dateFrom: d.date_from,
    dateTo: d.date_to,
  });

  const pay = d.payments || {};
  const cash = pay.cash || { count: 0, sales: 0, tips: 0 };
  const card = pay.card || { count: 0, sales: 0, tips: 0 };
  const comp = pay.comp || { count: 0, sales: 0 };

  // ── Clock ──
  if (d.clock_entries && d.clock_entries.length > 0) {
    sectionHeader(doc, h, 'Shift');
    d.clock_entries.forEach(c => {
      const inStr = new Date(c.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const outStr = c.clock_out
        ? new Date(c.clock_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : 'still in';
      kvRow(doc, h, 'Clock', `${inStr} — ${outStr}`);
    });
    kvRow(doc, h, 'Total Hours', `${d.hours_worked}h`, { isTotal: true });
  }

  // ── Sales ──
  sectionHeader(doc, h, 'Sales Summary');
  kvRow(doc, h, 'Tabs Closed', String(d.tabs));
  kvRow(doc, h, 'Gross Sales', $(d.gross_sales));
  kvRow(doc, h, 'Discounts', $(-d.discounts), { isNegative: d.discounts > 0 });
  kvRow(doc, h, 'Comps (' + d.comp_count + ' items)', $(-d.comp_total), { isNegative: d.comp_total > 0 });
  kvRow(doc, h, 'Voids', d.void_count + ' items');
  kvRow(doc, h, 'Tax', $(d.tax));
  kvRow(doc, h, 'Service Charge', $(d.auto_grat));

  // ── Payments ──
  sectionHeader(doc, h, 'Payment Summary');
  const payCols = [
    { label: 'Method', width: 140, align: 'left' },
    { label: 'Count', width: 80, align: 'right' },
    { label: 'Sales', width: 120, align: 'right' },
    { label: 'Tips', width: 164, align: 'right' },
  ];
  tableHeader(doc, h, payCols);
  tableRow(doc, h, payCols, ['Card', card.count, $(card.sales), $(card.tips)], { rowIndex: 0 });
  tableRow(doc, h, payCols, ['Cash', cash.count, $(cash.sales), $(cash.tips)], { rowIndex: 1 });
  if (comp.count > 0) {
    tableRow(doc, h, payCols, ['Comp', comp.count, $(comp.sales), '—'], { rowIndex: 2 });
  }

  // ── Cash Due + Tips ──
  sectionHeader(doc, h, 'Settlement');
  kvRow(doc, h, 'Cash Due', $(d.cash_due), { isTotal: true });
  kvRow(doc, h, 'CC Tips Owed', $(d.cc_tips), { isTotal: true });

  // ── Items Sold ──
  if (d.items && d.items.length > 0) {
    sectionHeader(doc, h, 'Items Sold');
    const itemCols = [
      { label: 'Item', width: 280, align: 'left' },
      { label: 'Qty', width: 80, align: 'right' },
      { label: 'Revenue', width: 144, align: 'right' },
    ];
    tableHeader(doc, h, itemCols);
    d.items.forEach((item, i) => {
      tableRow(doc, h, itemCols, [item.name, item.qty, $(item.revenue)], { rowIndex: i });
    });
  }

  finalize(doc);
  return doc;
}

module.exports = { generate };
