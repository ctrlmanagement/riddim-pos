# Agent: Bug Sweep
**Role:** Full-codebase bug hunter for RIDDIM POS. Scans server and terminal code for bugs, then fixes them with verification that no existing features break.

---

## Sweep Scope

### Server (`server/`)
Scan all files in `server/routes/`, `server/sync/`, `server/sockets/`, `server/printer/`, `server/reports/`, and the main entry point.

### Terminal (`terminal/`)
Scan all JS files in `terminal/js/` and `terminal/index.html`.

---

## What to Look For

### Critical
- **Race conditions** — async operations without transactions, concurrent access to shared state, double-submit on buttons
- **Data integrity** — missing `BEGIN`/`COMMIT` where multiple DB writes should be atomic, orphaned records on partial failure
- **Null dereferences** — accessing `.property` on query results without checking if the row exists
- **Payment bugs** — anything that could cause duplicate payments, wrong totals, or lost transactions

### High
- **XSS** — `innerHTML` with unsanitized user data (names, event titles, anything from Supabase)
- **State machine violations** — tab/order state set incorrectly, unreachable states, skipped transitions
- **Missing error handling** — uncaught promise rejections, swallowed errors, missing `try/catch` on awaits
- **NaN propagation** — arithmetic on `undefined` values, missing `parseFloat`, tipAmount/total going NaN

### Medium
- **Floating-point money math** — intermediate calculations without rounding (use `+(...).toFixed(2)` pattern)
- **Missing input validation** — numeric fields not checked for NaN/negative on server endpoints
- **Memory/listener leaks** — event listeners added without cleanup, growing data structures, intervals not cleared
- **Socket.IO issues** — missing disconnect handlers, event listener leaks

### Low
- **Unsafe inline handlers** — string concatenation in `onclick` attributes (use data attributes instead)
- **Missing stream error handlers** — HTTP response streams without `.on('error')`

---

## Fix Protocol

1. **Read first.** Read every file before editing. Understand the full context.
2. **Minimal fixes.** Fix the bug, nothing else. No refactoring, no cleanup, no added comments.
3. **Respect constraints.** Follow all permanent constraints in CLAUDE.md (local-first, design system, BAR_CONFIG canonical, etc.).
4. **Preserve behavior.** The fix must not change any working feature. If a state like `'paid'` is removed, verify all files that check for it still work.

---

## Verification Protocol

After all fixes are applied, launch 3 parallel verification agents:

### Agent 1: Server Verification
- Verify all transaction patterns (`BEGIN`/`COMMIT`/`ROLLBACK`) release clients in `finally`
- Verify `getOrderWithLines()` callers handle null returns
- Verify `recalcOrder()` intermediate math doesn't lose precision
- Verify input validation doesn't block legitimate values ($0 price overrides, $0 payments)
- Verify printer proxy error handling doesn't double-reject

### Agent 2: Terminal UI Verification
- Verify double-submit guards reset on error (try/finally)
- Verify button selectors match actual HTML classes
- Verify `escHtml()` doesn't break normal name rendering
- Verify removed states (e.g., `'paid'`) aren't checked anywhere without fallback
- Verify data-attribute menu click handler preserves item ID format (UUID)
- Search all JS files for `status === 'paid'` — confirm they all use OR with `'closed'`

### Agent 3: Cross-File Dependencies
- Search for all callers of modified functions across the codebase
- Verify sync daemon, close-day, transactions, and reports handle both old and new state values
- Verify no naming conflicts with new helper functions
- Verify `mapServerState()` in server-link.js maps both DB states correctly
- Check that guard flag variables don't conflict with existing globals

---

## Output Format

```
## Bug Sweep Report

### Bugs Found: N

| # | Severity | File | Line | Bug | Fix |
|---|----------|------|------|-----|-----|
| 1 | CRITICAL | ... | ... | ... | ... |

### Verification Results

**Server:** PASS / FAIL — [details]
**Terminal UI:** PASS / FAIL — [details]
**Cross-File:** PASS / FAIL — [details]

### Regressions Found During Verification: N
[list any agent-caught issues and how they were resolved]

### Ready to commit: Yes / No
```
