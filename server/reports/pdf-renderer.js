/**
 * RIDDIM POS — Shared PDF Renderer
 * Branded PDF template engine for all report exports.
 * Uses pdfkit for server-side PDF generation.
 *
 * Design: White background, obsidian text, gold accents.
 * Fonts: Helvetica (body), Helvetica-Bold (labels/headers).
 * Print-first layout matching RIDDIM brand identity.
 */

const PDFDocument = require('pdfkit');

// ── Brand colors (print-safe) ──
const C = {
  gold: '#D4A843',
  obsidian: '#0A0A0A',
  ash: '#888888',
  ivory: '#F5F0E8',
  lightIvory: '#FAFAF5',
  red: '#E74C3C',
  white: '#FFFFFF',
  border: '#CCCCCC',
  ruleDark: '#222222',
};

// ── Page config ──
const PAGE = {
  size: 'LETTER',
  margins: { top: 54, bottom: 54, left: 54, right: 54 },
  contentWidth: 504, // 7 inches
};

/**
 * Create a new branded PDF document.
 * @param {object} opts - { title, dateFrom, dateTo }
 * @returns {{ doc: PDFDocument, helpers: object }}
 */
function createReport(opts = {}) {
  const doc = new PDFDocument({
    size: PAGE.size,
    margins: PAGE.margins,
    bufferPages: true,
    info: {
      Title: opts.title || 'RIDDIM POS Report',
      Author: 'RIDDIM POS',
      Creator: 'RIDDIM POS Server',
    },
  });

  const helpers = {
    y: PAGE.margins.top,
    pageNum: 1,

    // ── Layout helpers ──
    get contentLeft() { return PAGE.margins.left; },
    get contentRight() { return PAGE.size === 'LETTER' ? 612 - PAGE.margins.right : 595 - PAGE.margins.right; },
    get contentWidth() { return PAGE.contentWidth; },
    get pageHeight() { return PAGE.size === 'LETTER' ? 792 : 842; },
    get bottomMargin() { return this.pageHeight - PAGE.margins.bottom - 20; },

    /**
     * Check if we need a new page. If so, add one with header.
     */
    checkPage(needed = 30) {
      if (this.y + needed > this.bottomMargin) {
        doc.addPage();
        this.pageNum++;
        this.y = PAGE.margins.top;
        renderHeader(doc, this, opts);
        this.y += 8;
      }
    },

    /**
     * Move Y cursor down
     */
    moveDown(pts = 12) {
      this.y += pts;
    },
  };

  // Render first page header
  renderHeader(doc, helpers, opts);
  helpers.moveDown(8);

  return { doc, helpers };
}

/**
 * Render the branded header at top of each page.
 */
function renderHeader(doc, h, opts) {
  const left = h.contentLeft;
  const right = h.contentRight;
  let y = PAGE.margins.top;

  // Brand name
  doc.font('Times-Bold').fontSize(18).fillColor(C.gold)
    .text('RIDDIM SUPPER CLUB', left, y);

  // Date range (right-aligned)
  const dateStr = opts.dateFrom
    ? (opts.dateFrom === opts.dateTo ? opts.dateFrom : `${opts.dateFrom} — ${opts.dateTo}`)
    : new Date().toISOString().slice(0, 10);
  doc.font('Helvetica').fontSize(9).fillColor(C.ash)
    .text(dateStr, left, y + 4, { width: h.contentWidth, align: 'right' });

  y += 22;

  // Address
  doc.font('Helvetica').fontSize(9).fillColor(C.ash)
    .text('84 Third St NW, Atlanta, GA 30308', left, y);
  y += 16;

  // Report title
  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.obsidian)
    .text(opts.title || 'Report', left, y);
  y += 26;

  // Print timestamp
  const now = new Date();
  const printStr = `Printed on: ${now.toLocaleDateString('en-US')} at ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  doc.font('Helvetica').fontSize(9).fillColor(C.ash)
    .text(printStr, left, y);
  y += 14;

  // Gold accent line
  doc.moveTo(left, y).lineTo(right, y).strokeColor(C.gold).lineWidth(1).stroke();
  y += 8;

  h.y = y;
}

/**
 * Finalize the PDF — add page numbers/footers to all pages.
 */
function finalize(doc) {
  const pages = doc.bufferedPageRange();
  const totalPages = pages.count;

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    const pageH = PAGE.size === 'LETTER' ? 792 : 842;
    const footerY = pageH - PAGE.margins.bottom;

    doc.font('Helvetica').fontSize(9).fillColor(C.ash);
    doc.text('Confidential', PAGE.margins.left, footerY);
    doc.text(`Page ${i + 1} of ${totalPages}`, PAGE.margins.left, footerY,
      { width: PAGE.contentWidth, align: 'right' });
  }

  doc.end();
}

// ═══════════════════════════════════════════════════
// SECTION PRIMITIVES — building blocks for all reports
// ═══════════════════════════════════════════════════

/**
 * Section header with ivory background and gold bottom border.
 */
function sectionHeader(doc, h, title) {
  h.checkPage(40);
  h.moveDown(12);

  const left = h.contentLeft;
  const width = h.contentWidth;

  // Ivory background
  doc.rect(left, h.y, width, 20).fill(C.ivory);

  // Title text
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.obsidian)
    .text(title.toUpperCase(), left + 6, h.y + 5, { width: width - 12 });

  // Gold bottom border
  doc.moveTo(left, h.y + 20).lineTo(left + width, h.y + 20)
    .strokeColor(C.gold).lineWidth(0.5).stroke();

  h.y += 26;
}

/**
 * Table header row.
 * @param {Array} columns - [{ label, width, align }]
 */
function tableHeader(doc, h, columns) {
  h.checkPage(20);
  const left = h.contentLeft;
  let x = left;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.ash);

  columns.forEach(col => {
    doc.text(col.label.toUpperCase(), x, h.y, {
      width: col.width,
      align: col.align || 'left',
    });
    x += col.width;
  });

  h.y += 14;

  // Bottom line
  doc.moveTo(left, h.y - 2).lineTo(left + h.contentWidth, h.y - 2)
    .strokeColor(C.border).lineWidth(0.5).stroke();
}

/**
 * Table data row. Alternating fills.
 * @param {Array} columns - [{ width, align }]
 * @param {Array} values - string values matching columns
 * @param {object} opts - { rowIndex, isTotal, isNegative }
 */
function tableRow(doc, h, columns, values, opts = {}) {
  h.checkPage(18);
  const left = h.contentLeft;
  const rowH = 16;

  // Alternating row fill
  if (!opts.isTotal && opts.rowIndex !== undefined && opts.rowIndex % 2 === 1) {
    doc.rect(left, h.y - 2, h.contentWidth, rowH).fill(C.lightIvory);
  }

  // Total row top border
  if (opts.isTotal) {
    doc.moveTo(left, h.y - 2).lineTo(left + h.contentWidth, h.y - 2)
      .strokeColor(C.ruleDark).lineWidth(0.5).stroke();
  }

  let x = left;
  const fontSize = opts.isTotal ? 10 : 9;
  const font = opts.isTotal ? 'Helvetica-Bold' : 'Helvetica';
  const color = opts.isNegative ? C.red : C.obsidian;

  doc.font(font).fontSize(fontSize).fillColor(color);

  values.forEach((val, i) => {
    const col = columns[i] || { width: 80, align: 'left' };
    doc.text(String(val), x + 2, h.y, {
      width: col.width - 4,
      align: col.align || 'left',
    });
    x += col.width;
  });

  h.y += rowH;
}

/**
 * Simple key-value row (label left, value right).
 */
function kvRow(doc, h, label, value, opts = {}) {
  h.checkPage(18);
  const left = h.contentLeft;
  const width = h.contentWidth;

  if (opts.isTotal) {
    doc.moveTo(left, h.y - 2).lineTo(left + width, h.y - 2)
      .strokeColor(C.ruleDark).lineWidth(0.5).stroke();
  }

  const fontSize = opts.isTotal ? 11 : 10;
  const font = opts.isTotal ? 'Helvetica-Bold' : 'Helvetica';
  const color = opts.isNegative ? C.red : C.obsidian;

  doc.font(font).fontSize(fontSize).fillColor(color);
  doc.text(label, left, h.y, { width: width * 0.65 });
  doc.text(String(value), left, h.y, { width: width, align: 'right' });

  h.y += opts.isTotal ? 18 : 16;
}

/**
 * Spacer — horizontal rule or blank space.
 */
function spacer(doc, h, type = 'blank') {
  if (type === 'rule') {
    h.checkPage(10);
    doc.moveTo(h.contentLeft, h.y)
      .lineTo(h.contentRight, h.y)
      .strokeColor(C.border).lineWidth(0.5).stroke();
    h.y += 8;
  } else {
    h.y += 8;
  }
}

/**
 * Dollar formatter
 */
function $(amount) {
  const num = parseFloat(amount) || 0;
  return (num < 0 ? '-' : '') + '$' + Math.abs(num).toFixed(2);
}

module.exports = {
  createReport,
  finalize,
  sectionHeader,
  tableHeader,
  tableRow,
  kvRow,
  spacer,
  $,
  C,
  PAGE,
};
