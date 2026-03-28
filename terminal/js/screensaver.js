/* RIDDIM POS — Screensaver
 *
 * Activates after SCREENSAVER_TIMEOUT_MS of inactivity on the login screen.
 * Shows RIDDIM logo with gentle breathing animation + clock.
 * Dismissed by any touch, click, or keypress — returns to login screen.
 */
'use strict';

const SCREENSAVER_TIMEOUT_MS = 30 * 1000; // 30 seconds

let _ssTimer = null;
let _ssClockInterval = null;
let _ssActive = false;

function startScreensaverTimer() {
  stopScreensaverTimer();
  _ssTimer = setTimeout(activateScreensaver, SCREENSAVER_TIMEOUT_MS);
}

function stopScreensaverTimer() {
  if (_ssTimer) { clearTimeout(_ssTimer); _ssTimer = null; }
}

function resetScreensaverTimer() {
  // Only reset if we're on the login screen and screensaver isn't active
  if (!currentUser && !_ssActive) {
    startScreensaverTimer();
  }
}

function activateScreensaver() {
  if (currentUser) return; // Don't activate if someone is logged in
  _ssActive = true;
  const el = document.getElementById('screensaver');
  if (el) el.classList.add('active');
  updateScreensaverClock();
  _ssClockInterval = setInterval(updateScreensaverClock, 10000);
}

function dismissScreensaver() {
  if (!_ssActive) return;
  _ssActive = false;
  const el = document.getElementById('screensaver');
  if (el) el.classList.remove('active');
  if (_ssClockInterval) { clearInterval(_ssClockInterval); _ssClockInterval = null; }
  startScreensaverTimer();
}

function updateScreensaverClock() {
  const el = document.getElementById('ssTime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}

// ── INIT ─────────────────────────────────────
function initScreensaver() {
  const ss = document.getElementById('screensaver');
  if (!ss) return;

  // Dismiss on any interaction
  ['touchstart', 'mousedown', 'keydown'].forEach(evt => {
    ss.addEventListener(evt, (e) => {
      e.preventDefault();
      dismissScreensaver();
    }, { passive: false });
  });

  // Reset timer on any activity while on login screen
  ['touchstart', 'mousedown', 'keydown'].forEach(evt => {
    document.addEventListener(evt, () => {
      if (!_ssActive) resetScreensaverTimer();
    });
  });
}

// Start on page load if on login screen
document.addEventListener('DOMContentLoaded', () => {
  initScreensaver();
  if (!currentUser) startScreensaverTimer();
});
