/* RIDDIM POS — ESC/POS Printer Driver
 *
 * Sends ESC/POS commands to Partner Tech RP-630 (USB) receipt printers.
 * Uses the 'usb' npm package for direct USB communication.
 *
 * Vendor: 076c  Product: 0302
 * Endpoint OUT: 0x02
 */
'use strict';

const USB_VENDOR  = 0x076c;
const USB_PRODUCT = 0x0302;
const EP_OUT      = 0x02;

// ESC/POS command constants
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

const CMD = {
  INIT:           Buffer.from([ESC, 0x40]),                  // Initialize printer
  CUT:            Buffer.from([GS, 0x56, 0x41, 0x03]),      // Partial cut with feed
  FEED:           (n) => Buffer.from([ESC, 0x64, n]),        // Feed n lines
  ALIGN_LEFT:     Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER:   Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT:    Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON:        Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:       Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_ON:      Buffer.from([ESC, 0x21, 0x30]),            // Double height + width
  DOUBLE_OFF:     Buffer.from([ESC, 0x21, 0x00]),            // Normal size
  UNDERLINE_ON:   Buffer.from([ESC, 0x2D, 0x01]),
  UNDERLINE_OFF:  Buffer.from([ESC, 0x2D, 0x00]),
  SEPARATOR:      Buffer.from('------------------------------------------\n'),
  OPEN_DRAWER:    Buffer.from([ESC, 0x70, 0x00, 0x19, 0xFA]), // Kick cash drawer
};

let device = null;
let iface = null;
let outEndpoint = null;

function open() {
  try {
    const usb = require('usb');
    device = usb.findByIds(USB_VENDOR, USB_PRODUCT);
    if (!device) {
      console.warn('[printer] RP-630 not found on USB');
      return false;
    }
    device.open();
    iface = device.interface(0);
    if (iface.isKernelDriverActive()) {
      iface.detachKernelDriver();
    }
    iface.claim();
    outEndpoint = iface.endpoint(EP_OUT);
    console.log('[printer] RP-630 connected');
    return true;
  } catch (e) {
    console.warn('[printer] Failed to open:', e.message);
    device = null;
    return false;
  }
}

function isOpen() {
  return !!outEndpoint;
}

function write(buf) {
  return new Promise((resolve, reject) => {
    if (!outEndpoint) return reject(new Error('Printer not connected'));
    outEndpoint.transfer(buf, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

async function text(str) {
  await write(Buffer.from(str, 'utf8'));
}

async function ln(str) {
  await text(str + '\n');
}

async function cmd(c) {
  await write(c);
}

async function row(left, right, width = 42) {
  const gap = width - left.length - right.length;
  const line = left + (gap > 0 ? ' '.repeat(gap) : ' ') + right;
  await ln(line);
}

async function separator() {
  await write(CMD.SEPARATOR);
}

async function cut() {
  await cmd(CMD.FEED(3));
  await cmd(CMD.CUT);
}

async function openDrawer() {
  await cmd(CMD.OPEN_DRAWER);
}

// ── RECEIPT FORMATTING ──────────────────────────────────

async function printReceipt(tab, config = {}) {
  if (!isOpen() && !open()) {
    throw new Error('Printer not available');
  }

  const taxRate = config.tax_rate || 0.089;
  const footer  = config.receipt_footer || 'Thank you for dining with us!';

  const lines = (tab.lines || []).filter(l => !l.voided);
  const sub = lines.reduce((s, l) => s + (l.comped ? 0 : l.price * l.qty), 0);
  const disc = tab.discountPct ? sub * tab.discountPct : (tab.discountAmt || 0);
  const afterDisc = sub - disc;
  const tax = afterDisc * taxRate;
  const grat = tab.autoGrat ? afterDisc * tab.autoGrat : 0;
  const tip = tab.tipAmount || 0;
  const total = afterDisc + tax + grat + (tab.autoGrat ? 0 : tip);

  const now = tab.closedAt ? new Date(tab.closedAt) : new Date();
  const date = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  await cmd(CMD.INIT);

  // Header
  await cmd(CMD.ALIGN_CENTER);
  await cmd(CMD.DOUBLE_ON);
  await ln('RIDDIM');
  await cmd(CMD.DOUBLE_OFF);
  await ln('SUPPER CLUB');
  await ln('Atlanta, GA');
  await cmd(CMD.ALIGN_LEFT);
  await separator();

  // Order info
  await row(`Order #${tab.orderNum || '-'}`, `Sale: ${tab.saleNum || '-'}`);
  await row(tab.name || 'Tab', (tab.payMethod || '').toUpperCase());
  await row(`Server: ${tab.serverName || 'Staff'}`, tab.station || '');
  await row(date, time);
  if (tab.tableNum) await row(`Table ${tab.tableNum}`, `Guests: ${tab.guestCount || 1}`);
  await separator();

  // Items
  for (const l of lines) {
    const price = l.comped ? '  COMP' : '$' + (l.price * l.qty).toFixed(2);
    const seat = l.seat ? ` [S${l.seat}]` : '';
    await row(`${l.qty}x ${l.name}${seat}`, price);
  }
  await separator();

  // Totals
  await row('Subtotal', '$' + sub.toFixed(2));
  if (disc > 0) {
    const label = tab.discountPct ? `${(tab.discountPct * 100).toFixed(0)}% discount` : 'Discount';
    await row(label, '-$' + disc.toFixed(2));
  }
  await row(`Tax (${(taxRate * 100).toFixed(1)}%)`, '$' + tax.toFixed(2));
  if (grat > 0) {
    await row(`Gratuity (${(tab.autoGrat * 100).toFixed(0)}%)`, '$' + grat.toFixed(2));
  }
  if (tip > 0 && !tab.autoGrat) {
    await row('Tip', '$' + tip.toFixed(2));
  }

  // Deposit
  if (tab.depositUsed > 0) {
    await row('Deposit Applied', '-$' + tab.depositUsed.toFixed(2));
    if (tab.depositUnused > 0) {
      await row('Unused → Other Inc', '$' + tab.depositUnused.toFixed(2));
    }
    if (tab.balanceDue > 0) {
      await row(`Balance (${(tab.payMethod || 'card').toUpperCase()})`, '$' + tab.balanceDue.toFixed(2));
    }
  }

  await cmd(CMD.BOLD_ON);
  await row('TOTAL', '$' + total.toFixed(2));
  await cmd(CMD.BOLD_OFF);

  // Min spend
  if (tab.minSpendRequired > 0) {
    const met = (sub + tax) >= tab.minSpendRequired;
    await cmd(CMD.ALIGN_CENTER);
    await ln(`Min Spend: $${tab.minSpendRequired.toFixed(0)} ${met ? '(MET)' : '(NOT MET)'}`);
    await cmd(CMD.ALIGN_LEFT);
  }

  await separator();

  // Footer
  await cmd(CMD.ALIGN_CENTER);
  await ln(footer);
  await cmd(CMD.ALIGN_LEFT);

  await cut();
}

// ── TEST PRINT ──────────────────────────────────────────

async function testPrint() {
  if (!isOpen() && !open()) {
    throw new Error('Printer not available');
  }
  await cmd(CMD.INIT);
  await cmd(CMD.ALIGN_CENTER);
  await cmd(CMD.DOUBLE_ON);
  await ln('RIDDIM POS');
  await cmd(CMD.DOUBLE_OFF);
  await ln('Printer Test');
  await separator();
  await ln(new Date().toLocaleString());
  await ln('RP-630 OK');
  await separator();
  await cut();
}

function close() {
  try {
    if (iface) iface.release(() => {});
    if (device) device.close();
  } catch (e) { /* ignore */ }
  device = null;
  iface = null;
  outEndpoint = null;
}

module.exports = { open, close, isOpen, printReceipt, testPrint, openDrawer, text, ln, cmd, row, separator, cut, CMD };
