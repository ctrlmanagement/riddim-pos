/**
 * RIDDIM POS — Custom Report PDF
 * Assembles selected sections into a single branded PDF.
 * Each section is a self-contained render function.
 */

const { createReport, finalize, sectionHeader, tableHeader, tableRow, kvRow, spacer, $ } = require('./pdf-renderer');

// ── Section renderers ──
// Each takes (doc, h, data) where data is the full aggregated dataset.

const SECTIONS = {
  sales_summary(doc, h, d) {
    sectionHeader(doc, h, 'Sales Summary');
    kvRow(doc, h, 'Gross Sales', $(d.gross_sales));
    kvRow(doc, h, 'Discounts', $(-d.discounts), { isNegative: d.discounts > 0 });
    kvRow(doc, h, 'Comps', $(-d.comp_total), { isNegative: d.comp_total > 0 });
    kvRow(doc, h, 'Net Sales', $(d.net_sales), { isTotal: true });
    kvRow(doc, h, 'Sales Tax', $(d.sales_tax));
    kvRow(doc, h, 'Service Fees', $(d.service_fees));
    kvRow(doc, h, 'Gross Revenue', $(d.gross_revenue), { isTotal: true });
    spacer(doc, h);
    kvRow(doc, h, 'Checks Closed', String(d.order_count));
    kvRow(doc, h, 'Average Check', $(d.avg_check));
  },

  payment_summary(doc, h, d) {
    sectionHeader(doc, h, 'Payment Breakdown');
    const pay = d.payments || {};
    const cash = pay.cash || { count: 0, sales: 0, tips: 0 };
    const card = pay.card || { count: 0, sales: 0, tips: 0 };
    const comp = pay.comp || { count: 0, sales: 0 };
    const cols = [
      { label: 'Method', width: 140, align: 'left' },
      { label: 'Count', width: 70, align: 'right' },
      { label: 'Sales', width: 100, align: 'right' },
      { label: 'Tips', width: 100, align: 'right' },
      { label: 'Total', width: 94, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    tableRow(doc, h, cols, ['Card', card.count, $(card.sales), $(card.tips), $(card.sales + card.tips)], { rowIndex: 0 });
    tableRow(doc, h, cols, ['Cash', cash.count, $(cash.sales), $(cash.tips), $(cash.sales + cash.tips)], { rowIndex: 1 });
    if (comp.count > 0) tableRow(doc, h, cols, ['Comp', comp.count, $(comp.sales), '—', $(comp.sales)], { rowIndex: 2 });
    const tot = card.sales + cash.sales + comp.sales;
    tableRow(doc, h, cols, ['Total', card.count + cash.count + comp.count, $(tot), $(d.total_tips), $(tot + d.total_tips)], { isTotal: true });
  },

  cash_reconciliation(doc, h, d) {
    const cr = d.cash_reconciliation || {};
    sectionHeader(doc, h, 'Cash Reconciliation');
    kvRow(doc, h, 'Gross Cash', $(cr.gross_cash));
    kvRow(doc, h, 'Less Tips', $(-cr.less_tips), { isNegative: cr.less_tips > 0 });
    kvRow(doc, h, 'Less Paid Outs', $(-cr.paid_outs), { isNegative: cr.paid_outs > 0 });
    kvRow(doc, h, 'Net Cash Retained', $(cr.net_cash_retained), { isTotal: true });
    kvRow(doc, h, 'Cash Deposit', $(cr.cash_deposit), { isTotal: true });
  },

  paid_outs(doc, h, d) {
    sectionHeader(doc, h, 'Paid Outs');
    if (!d.paid_outs || d.paid_outs.length === 0) {
      kvRow(doc, h, 'No paid outs', '$0.00');
      return;
    }
    const cols = [
      { label: 'Category', width: 280, align: 'left' },
      { label: 'Count', width: 80, align: 'right' },
      { label: 'Amount', width: 144, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    d.paid_outs.forEach((po, i) => tableRow(doc, h, cols, [po.category, po.count, $(po.total)], { rowIndex: i }));
    tableRow(doc, h, cols, ['Total Paid Outs', '', $(d.total_paid_outs)], { isTotal: true });
  },

  comp_summary(doc, h, d) {
    sectionHeader(doc, h, 'Comp Summary');
    if (!d.comps_by_reason || d.comps_by_reason.length === 0) {
      kvRow(doc, h, 'No comps', '');
      return;
    }
    const cols = [
      { label: 'Reason', width: 280, align: 'left' },
      { label: 'Count', width: 80, align: 'right' },
      { label: 'Amount', width: 144, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    d.comps_by_reason.forEach((c, i) => tableRow(doc, h, cols, [c.reason, c.count, $(c.amount)], { rowIndex: i }));
    tableRow(doc, h, cols, ['Total Comps', '', $(d.comp_total)], { isTotal: true });
  },

  void_summary(doc, h, d) {
    sectionHeader(doc, h, 'Void Summary');
    if (!d.voids_by_reason || d.voids_by_reason.length === 0) {
      kvRow(doc, h, 'No voids', '');
      return;
    }
    const cols = [
      { label: 'Reason', width: 280, align: 'left' },
      { label: 'Count', width: 80, align: 'right' },
      { label: 'Amount', width: 144, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    d.voids_by_reason.forEach((v, i) => tableRow(doc, h, cols, [v.reason, v.count, $(v.amount)], { rowIndex: i }));
  },

  employee_sales(doc, h, d) {
    sectionHeader(doc, h, 'Employee Sales');
    if (!d.employees || d.employees.length === 0) {
      kvRow(doc, h, 'No employee data', '');
      return;
    }
    const cols = [
      { label: 'Server', width: 160, align: 'left' },
      { label: 'Tabs', width: 60, align: 'right' },
      { label: 'Sales', width: 100, align: 'right' },
      { label: 'Tips', width: 100, align: 'right' },
      { label: 'Hours', width: 84, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    d.employees.forEach((e, i) => {
      tableRow(doc, h, cols, [e.server_name, e.tabs, $(e.sales), $(e.tips), e.hours.toFixed(1) + 'h'], { rowIndex: i });
    });
  },

  employee_tips(doc, h, d) {
    sectionHeader(doc, h, 'Employee Tips');
    if (!d.employees || d.employees.length === 0) {
      kvRow(doc, h, 'No tip data', '');
      return;
    }
    const cols = [
      { label: 'Server', width: 200, align: 'left' },
      { label: 'Tabs', width: 80, align: 'right' },
      { label: 'Tips', width: 120, align: 'right' },
      { label: 'Avg Tip', width: 104, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    d.employees.forEach((e, i) => {
      const avgTip = e.tabs > 0 ? e.tips / e.tabs : 0;
      tableRow(doc, h, cols, [e.server_name, e.tabs, $(e.tips), $(avgTip)], { rowIndex: i });
    });
    const totalTips = d.employees.reduce((s, e) => s + e.tips, 0);
    tableRow(doc, h, cols, ['Total', '', $(totalTips), ''], { isTotal: true });
  },

  hourly_sales(doc, h, d) {
    sectionHeader(doc, h, 'Hourly Sales');
    if (!d.hours || d.hours.length === 0) {
      kvRow(doc, h, 'No hourly data', '');
      return;
    }
    const cols = [
      { label: 'Hour', width: 140, align: 'left' },
      { label: 'Tabs', width: 80, align: 'right' },
      { label: 'Items', width: 100, align: 'right' },
      { label: 'Sales', width: 184, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    d.hours.forEach((hr, i) => {
      tableRow(doc, h, cols, [hr.label, hr.tabs, hr.items, $(hr.sales)], { rowIndex: i });
    });
  },

  station_sales(doc, h, d) {
    sectionHeader(doc, h, 'Station Sales');
    if (!d.stations || d.stations.length === 0) {
      kvRow(doc, h, 'No station data', '');
      return;
    }
    const cols = [
      { label: 'Station', width: 140, align: 'left' },
      { label: 'Tabs', width: 80, align: 'right' },
      { label: 'Sales', width: 120, align: 'right' },
      { label: 'Tips', width: 164, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    d.stations.forEach((s, i) => {
      tableRow(doc, h, cols, [s.station, s.tabs, $(s.sales), $(s.tips)], { rowIndex: i });
    });
  },

  product_mix(doc, h, d) {
    sectionHeader(doc, h, 'Product Mix');
    if (!d.items || d.items.length === 0) {
      kvRow(doc, h, 'No product data', '');
      return;
    }
    const cols = [
      { label: 'Item', width: 200, align: 'left' },
      { label: 'Qty', width: 60, align: 'right' },
      { label: 'Revenue', width: 120, align: 'right' },
      { label: '% Mix', width: 124, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    d.items.forEach((item, i) => {
      tableRow(doc, h, cols, [item.name, item.qty, $(item.revenue), item.pct.toFixed(1) + '%'], { rowIndex: i });
    });
  },

  clock_entries(doc, h, d) {
    sectionHeader(doc, h, 'Clock In/Out Log');
    if (!d.clock_log || d.clock_log.length === 0) {
      kvRow(doc, h, 'No clock entries', '');
      return;
    }
    const cols = [
      { label: 'Staff', width: 160, align: 'left' },
      { label: 'Clock In', width: 120, align: 'left' },
      { label: 'Clock Out', width: 120, align: 'left' },
      { label: 'Hours', width: 104, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    d.clock_log.forEach((c, i) => {
      const inStr = new Date(c.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const outStr = c.clock_out
        ? new Date(c.clock_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : 'still in';
      const mins = c.clock_out ? Math.floor((new Date(c.clock_out) - new Date(c.clock_in)) / 60000) : 0;
      const hrs = mins > 0 ? (mins / 60).toFixed(1) + 'h' : '—';
      tableRow(doc, h, cols, [c.staff_name, inStr, outStr, hrs], { rowIndex: i });
    });
  },

  top_items(doc, h, d) {
    sectionHeader(doc, h, 'Top 10 Items');
    if (!d.items || d.items.length === 0) {
      kvRow(doc, h, 'No product data', '');
      return;
    }
    const top = d.items.slice(0, 10);
    const cols = [
      { label: '#', width: 30, align: 'right' },
      { label: 'Item', width: 230, align: 'left' },
      { label: 'Qty', width: 80, align: 'right' },
      { label: 'Revenue', width: 164, align: 'right' },
    ];
    tableHeader(doc, h, cols);
    top.forEach((item, i) => {
      tableRow(doc, h, cols, [i + 1, item.name, item.qty, $(item.revenue)], { rowIndex: i });
    });
  },
};

/**
 * Generate a custom report PDF from selected sections.
 * @param {string[]} sections - array of section IDs to include
 * @param {object} data - aggregated data from all required queries
 * @param {string} presetName - optional preset name for the title
 */
function generate(sections, data, presetName) {
  const title = presetName || 'Custom Report';
  const { doc, helpers: h } = createReport({
    title,
    dateFrom: data.date_from,
    dateTo: data.date_to,
  });

  sections.forEach(sectionId => {
    const renderer = SECTIONS[sectionId];
    if (renderer) {
      renderer(doc, h, data);
    }
  });

  finalize(doc);
  return doc;
}

// Export section list for the builder UI
const SECTION_LIST = [
  { id: 'sales_summary', label: 'Sales Summary' },
  { id: 'payment_summary', label: 'Payment Breakdown' },
  { id: 'cash_reconciliation', label: 'Cash Reconciliation' },
  { id: 'paid_outs', label: 'Paid Outs by Category' },
  { id: 'comp_summary', label: 'Comp Summary' },
  { id: 'void_summary', label: 'Void Summary' },
  { id: 'employee_sales', label: 'Employee Sales' },
  { id: 'employee_tips', label: 'Employee Tips' },
  { id: 'hourly_sales', label: 'Hourly Sales' },
  { id: 'station_sales', label: 'Station Sales' },
  { id: 'product_mix', label: 'Product Mix' },
  { id: 'clock_entries', label: 'Clock In/Out Log' },
  { id: 'top_items', label: 'Top 10 Items' },
];

module.exports = { generate, SECTIONS, SECTION_LIST };
