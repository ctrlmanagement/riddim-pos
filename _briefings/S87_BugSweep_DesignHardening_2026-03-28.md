# S87 — Bug Sweep, Pressure Test, Design Hardening
**Date:** 2026-03-28
**Session type:** Security + QA + Design

---

## What Happened

Full codebase sweep using 4-persona pressure testing methodology. Three custom agent prompts created and executed. 42 total fixes applied across 32+ files.

### Bug Fixes (22)
- Payment INSERT+UPDATE wrapped in atomic transaction
- Multi-line insert wrapped in transaction
- `getOrderWithLines()` null check + 404 on all 8 callers
- `recalcOrder` subtotal + intermediate float rounding
- Price override, payment amount, tip amount, declared_tips input validation
- Double-submit guards on PAY (try/finally) and FIRE (1.2s cooldown)
- XSS: `escHtml()` applied across cart, tables, recall tabs, mgmt-reports, payment member info
- Menu click handler switched to data-attributes
- State overwrite `paid→closed` removed
- NaN tip guard, printer proxy error handlers
- Receipt + session float math rounding
- Clock-in async with server 409 error handling
- Socket.IO listener cleanup on reconnect

### Server-Side Security (10)
- **Permission middleware** (`server/middleware/auth.js`) — `requirePermission()` + `requireOwner()` with DB lookup + 60s cache
- Void line/tab, comp, price override, tip adjust, paid-out delete all gated by permission
- `/clear-all` gated by owner-only
- Void-after-payment blocked (state check)
- PIN lockout (5 attempts → 60s + audit log)

### Data Persistence
- 86 list persisted to `pos_86_items` table, loaded on terminal connect via socket
- Offline item queue (localStorage) with flush on reconnect
- Cash deposit override audit trail
- Unused deposit surplus recorded as audit entry

### Design Improvements (10)
- Font sizes: prices 13px, badges 11px, labels 12px (WCAG compliance)
- Ash contrast #888→#999 (passes WCAG AA)
- New tab button 32→44px (touch target compliance)
- Cart panel 320→380px + sticky footer
- Tip presets reordered: 18/20/25 first, No Tip demoted
- Color-coded toasts: red=error, green=success, gold=default
- Floor plan enlarged (860px max) + section labels 13px
- Venue name extracted to CONFIG (receipt + printer)
- Search boxes in View Servers + Closed Checks

### Qty Picker
- Long-press (400ms) on menu item opens qty modal
- Quick-set buttons: 1, 2, 3, 5, 10
- +/- buttons for fine adjustment
- Single tap still adds 1 (unchanged speed)

### Recall Tabs Fix
- `openRecallTabs()` was bypassing `getVisibleTabs()` — staff could see owner tabs
- Fixed to use role-filtered `getVisibleTabs(['open', 'sent'])`

## New Agent Prompts
- `.claude/agents/bug-sweep.md` — full-codebase bug scanner with verification protocol
- `.claude/agents/pressure-test.md` — 4-persona stress test (bartender, manager, nightlife vet, owner)
- `.claude/agents/design-flow-test.md` — 4-persona UI/UX assessment for high-volume service

## Commits
- `ee306cd` — S87 full sweep (22 bugs, permissions, design)
- `be6624e` — Qty picker (long-press menu item)
- `3724aac` — Recall tabs role filtering fix

## What's Next
- Qty numpad is live — monitor bartender feedback on 400ms hold delay
- Server-side permissions depend on `staff` + `pos_security_permissions` tables being in local PG — verify sync populates them
- Pressure test identified remaining feature gaps: tab transfer, split tendering, 4 missing PDF exports, BOH day-close endpoint
- Design test identified remaining items: high-contrast mode toggle, haptic feedback, favorites strip
