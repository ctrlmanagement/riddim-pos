/**
 * RIDDIM POS — DSR (Daily Summary Report) PDF
 */

const { createReport, finalize, sectionHeader, tableHeader, tableRow, kvRow, spacer, $ } = require('./pdf-renderer');

function generate(data) {
  const { doc, helpers: h } = createReport({
    title: 'Daily Summary',
    dateFrom: data.date_from,
    dateTo: data.date_to,
  });

  const d = data;
  const pay = d.payments || {};
  const cash = pay.cash || { count: 0, sales: 0, tips: 0 };
  const card = pay.card || { count: 0, sales: 0, tips: 0 };
  const comp = pay.comp || { count: 0, sales: 0 };
  const cr = d.cash_reconciliation || {};

  // ── Sales Summary ──
  sectionHeader(doc, h, 'Sales Summary');
  kvRow(doc, h, 'Gross Sales', $(d.gross_sales));
  kvRow(doc, h, 'Less Discounts', $(-d.discounts), { isNegative: d.discounts > 0 });
  kvRow(doc, h, 'Less Comps', $(-d.comp_total), { isNegative: d.comp_total > 0 });
  kvRow(doc, h, 'Net Sales', $(d.net_sales), { isTotal: true });
  kvRow(doc, h, 'Sales Tax', $(d.sales_tax));
  kvRow(doc, h, 'Service Charge', $(d.service_fees));
  kvRow(doc, h, 'Gross Revenue', $(d.gross_revenue), { isTotal: true });
  spacer(doc, h);
  kvRow(doc, h, 'Checks Closed', String(d.order_count));
  kvRow(doc, h, 'Checks Voided', String(d.void_count));
  kvRow(doc, h, 'Guests', String(d.guest_count));
  kvRow(doc, h, 'Average Check', $(d.avg_check));

  // ── Payment Summary ──
  sectionHeader(doc, h, 'Payment Summary');
  const payCols = [
    { label: 'Method', width: 140, align: 'left' },
    { label: 'Count', width: 70, align: 'right' },
    { label: 'Sales', width: 100, align: 'right' },
    { label: 'Tips', width: 100, align: 'right' },
    { label: 'Total', width: 94, align: 'right' },
  ];
  tableHeader(doc, h, payCols);
  tableRow(doc, h, payCols, ['Card', card.count, $(card.sales), $(card.tips), $(card.sales + card.tips)], { rowIndex: 0 });
  tableRow(doc, h, payCols, ['Cash', cash.count, $(cash.sales), $(cash.tips), $(cash.sales + cash.tips)], { rowIndex: 1 });
  if (comp.count > 0) {
    tableRow(doc, h, payCols, ['Comp', comp.count, $(comp.sales), '—', $(comp.sales)], { rowIndex: 2 });
  }
  const totalSales = card.sales + cash.sales + comp.sales;
  tableRow(doc, h, payCols, ['Total', card.count + cash.count + comp.count, $(totalSales), $(d.total_tips), $(totalSales + d.total_tips)], { isTotal: true });

  // ── Expenditures / Paid Outs ──
  sectionHeader(doc, h, 'Expenditures / Adjustments');
  if (d.paid_outs && d.paid_outs.length > 0) {
    const poCols = [
      { label: 'Category', width: 280, align: 'left' },
      { label: 'Count', width: 80, align: 'right' },
      { label: 'Amount', width: 144, align: 'right' },
    ];
    tableHeader(doc, h, poCols);
    d.paid_outs.forEach((po, i) => {
      tableRow(doc, h, poCols, [po.category, po.count, $(po.total)], { rowIndex: i });
    });
    tableRow(doc, h, poCols, ['Total Paid Outs', '', $(d.total_paid_outs)], { isTotal: true });
  } else {
    kvRow(doc, h, 'Paid Outs', '$0.00');
  }

  // ── Cash Reconciliation ──
  sectionHeader(doc, h, 'Cash Reconciliation');
  kvRow(doc, h, 'Gross Cash', $(cr.gross_cash));
  kvRow(doc, h, 'Less Tips', $(-cr.less_tips), { isNegative: cr.less_tips > 0 });
  kvRow(doc, h, 'Less Service Charge', $(-cr.less_srv_charge), { isNegative: cr.less_srv_charge > 0 });
  kvRow(doc, h, 'Less Paid Outs', $(-cr.paid_outs), { isNegative: cr.paid_outs > 0 });
  kvRow(doc, h, 'Net Cash Retained', $(cr.net_cash_retained), { isTotal: true });
  kvRow(doc, h, 'Cash Deposit', $(cr.cash_deposit), { isTotal: true });

  // ── Comp Summary ──
  if (d.comps_by_reason && d.comps_by_reason.length > 0) {
    sectionHeader(doc, h, 'Comp Summary');
    const compCols = [
      { label: 'Reason', width: 280, align: 'left' },
      { label: 'Count', width: 80, align: 'right' },
      { label: 'Amount', width: 144, align: 'right' },
    ];
    tableHeader(doc, h, compCols);
    d.comps_by_reason.forEach((c, i) => {
      tableRow(doc, h, compCols, [c.reason, c.count, $(c.amount)], { rowIndex: i });
    });
    tableRow(doc, h, compCols, ['Total Comps', '', $(d.comp_total)], { isTotal: true });
  }

  // ── Void Summary ──
  if (d.voids_by_reason && d.voids_by_reason.length > 0) {
    sectionHeader(doc, h, 'Void Summary');
    const voidCols = [
      { label: 'Reason', width: 280, align: 'left' },
      { label: 'Count', width: 80, align: 'right' },
      { label: 'Amount', width: 144, align: 'right' },
    ];
    tableHeader(doc, h, voidCols);
    d.voids_by_reason.forEach((v, i) => {
      tableRow(doc, h, voidCols, [v.reason, v.count, $(v.amount)], { rowIndex: i });
    });
  }

  finalize(doc);
  return doc;
}

module.exports = { generate };
