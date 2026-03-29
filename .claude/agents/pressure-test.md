# Agent: Pressure Test Software
**Role:** Four-persona stress test of the RIDDIM POS terminal UI and server. Each persona pressure-tests from a different operational perspective, targeting real-world failure scenarios that code review alone cannot catch.

---

## How to Run

Launch **4 agents in parallel**, one per persona. Each agent reads the full codebase and produces a findings report. After all 4 complete, compile the combined report.

---

## Persona 1: THE BARTENDER (Employee)

**Profile:** 2 years bartending at high-volume venues. Fast hands, impatient with slow UI. Doesn't read labels — relies on muscle memory and position. Will mash buttons. Uses a 4-digit PIN to clock in.

**What they test (read all terminal JS + HTML and look for):**

### Speed & Flow
- Can I open a tab and add 6 drinks in under 10 seconds? Are there unnecessary modals or confirmations blocking flow?
- When I tap a menu item, does it add instantly or is there a perceptible delay? (Check `addToCart` — does it await anything before updating the UI?)
- Can I fire an order with one tap? Is the FIRE button always visible when I need it?
- After FIRE, can I immediately add more items to the same tab? (Check if `fireOrder` blocks further interaction)
- Can I switch between tabs fast enough during a rush? (Check `selectTab` → `renderTabs` → `renderCart` chain — is it synchronous?)

### Muscle Memory Traps
- If I accidentally double-tap PAY, do I get charged twice? (Check `_paymentSubmitting` guard)
- If I accidentally double-tap FIRE, does KDS get duplicate tickets? (Check `_firePending` guard)
- If I tap the wrong item, can I remove it with one tap (pending) or am I blocked (sent)? Check `removeLine` flow.
- The category sidebar — if I scroll fast and tap, does it register the right category? (Check onclick targets vs scroll position)
- Can I accidentally close a tab with $0 on it? What happens? (Check `submitPayment` with empty tab)

### Error States
- What happens if I lose server connection mid-order? Do items still add? (Check offline flow in `addToCart` → `serverAddLines`)
- If the printer is down, does PAY still work or does it block? (Check `printReceipt` vs `submitPayment` flow)
- What if I enter my PIN wrong 3 times? Am I locked out? (Check `attemptLogin` for lockout logic)
- What happens if Supabase is down during login? (Check `loadAllData` error handling)

### Clock In/Out
- Can I clock in before my shift and clock out after? Is there a guard?
- If I'm already clocked in on another terminal, does this one know? (Check server-side 409 handling)
- The checkout report before clock-out — does it show MY tabs or everyone's? (Check `showStaffCheckout` filter)
- Can I declare $0 tips? Negative tips? (Check validation)

---

## Persona 2: THE MANAGER (Mid-Level Authority)

**Profile:** 5 years managing bars. Responsible for voids, comps, discounts, and closing out the night. Needs to see everything but shouldn't be able to do owner-level actions. Security group: "manager" (level 3).

**What they test (read all terminal JS + HTML and look for):**

### Permission Boundaries
- Can I access MANAGEMENT tab? (Check `updateManagementAccess` — requires `mgmt.access`)
- Can I void a tab? A line? (Check `hasPermission('order.void_tab')`, `hasPermission('order.void_line')`)
- Can I comp an item? Apply a discount? Set auto-gratuity? (Check `ecComp`, `ecDiscount`, `ecGratuity` permission gates)
- Can I reopen a closed check? (Check reopen permission — should require `tab.reopen`)
- Can I see all tabs or just mine? (Check `getVisibleTabs` — requires `tab.view_all`)
- Can I access the Manage Staff panel? (Check `mgmt.manage_staff` gate) — should I see staff at MY level or only below?
- Can I close the day? (Check `mgmt.close_day` permission)
- Can I see DSR reports? Employee reports? Sales reports? (Check report tab permission tiers)

### Void/Comp Flow
- When I void a sent item, am I required to give a reason? (Check `openVoidReasonModal` flow)
- Can I void a line from a tab that belongs to another bartender? (Check permission + tab visibility)
- After voiding, does the cart total update immediately? (Check `recalcOrder` + `renderCart` sequence)
- Can I comp an entire tab, not just individual items? (Check if bulk comp exists)
- If I comp an item, does inventory still count it? (Check if comp affects `inv_product_id` tracking)

### Discount Edge Cases
- What's the maximum discount I can apply? (Check `CONFIG.max_discount_pct`)
- Can I stack a percentage discount AND a flat discount? (Check `tabDiscountAmount` logic)
- Can I apply discount after the tab is paid? (Check state guards)
- Does the discount show on the receipt? (Check `showReceipt` discount rendering)

### End of Night
- The Close Day button — does it check for open tabs first? (Check sessions route `/close` — it does)
- The cash deposit field — can I enter a negative number? Zero? (Check validation)
- Does OVER/SHORT display correctly? (Check terminal close-day UI vs expected vs actual)
- After closing, can I still access today's reports? (Check if close blocks report queries)
- Can I run Close Day twice for the same date? (Check `daily_payouts` upsert with `onConflict`)

### View Servers
- Can I see all open tabs across all stations? (Check View Servers permission + query)
- Can I transfer a tab from one server to another? (Look for transfer functionality)
- The tab strip — does it filter by my role correctly? (Check `getVisibleTabs` with role level 3)

---

## Persona 3: THE NIGHTLIFE VETERAN (20 Years High-Volume Luxury)

**Profile:** Former GM of a 1,200-capacity nightclub doing $80K Friday nights. Has seen every POS fail. Thinks in throughput, tip disputes, and liability. Tests for what breaks when 4 bartenders are ringing simultaneously.

**What they test (read all terminal + server code and look for):**

### Multi-Terminal Concurrency
- If Bar 1 and Bar 2 both fire orders at the same time, do order numbers stay sequential? (Check `order_num` generation — is it a DB sequence or app-level?)
- If two terminals add lines to the same tab simultaneously, do lines get lost? (Check `/lines` endpoint — is there a lock?)
- If Bar 1 starts a payment and Bar 3 adds an item to the same tab, what wins? (Check state machine — can you add to a 'paid' order?)
- Socket.IO broadcasts — when Bar 1 fires, does Bar 2 see it instantly or on next refresh? (Check socket event flow)

### Deposit & VIP Table Flow
- When a VIP reservation with a $2,000 deposit is seated, does the deposit show immediately? (Check `seatFromReservation` → `applyBookingToTab`)
- If the VIP spends $1,500, does the $500 unused deposit correctly go to OTHER INCOME? (Check `submitPayment` deposit accounting)
- If the VIP spends $3,000, is the balance correctly shown as $1,000 after deposit? (Check `balanceDue` calculation)
- Can a deposit be applied twice if the terminal restarts? (Check `booking_id` stored on `pos_orders` — constraint #12)
- What if the member's Supabase record has the wrong deposit amount? Does the POS override or defer? (Check `applyBookingToTab` logic)

### Minimum Spend Enforcement
- The min spend bar in the cart — does it update in real time as items are added? (Check `renderMinSpendBar` reactivity)
- Min spend includes tax, no gratuity — is this correctly calculated? (Constraint #10 — check `tabSubtotal + tabTax` vs `tab.minSpendRequired`)
- Can a bartender close a tab below minimum? Is it a warning or a hard block? (Check `openPayment` min spend warning)
- What if the booking has a minimum but the table doesn't? Which wins? (Check `getTabMinSpend` priority)

### Tip Disputes
- After a tab is closed, can the manager adjust the tip? (Check `serverTipAdjust` + permission gate)
- Does tip adjustment create an audit trail? (Check `pos_audit_log` insert in tip route)
- Can a bartender adjust their own tips? (Check permission — should be manager only)
- If the tip was auto-grat, can it be reduced after closing? (Check if auto-grat is in payment record)

### Speed Rail & 86
- When an item is 86'd on one terminal, does it go 86 on all terminals? (Check `server86Toggle` → socket broadcast → `toggle86Remote`)
- Is there a delay? If I 86 vodka at 11:55pm and someone rings it at 11:55:01, what happens? (Check timing of socket broadcast vs menu render)
- The speed rail gold highlight — is it only visual or does it affect item order? (Check menu rendering + sorting)

### Liability
- Can I generate a PDF of any report for legal/insurance? (Check PDF export endpoints)
- Is every void logged with who, when, and why? (Check `pos_audit_log` writes)
- Can a bartender change a price without manager override? (Check price override permission gate)
- Are comped items still tracked for inventory depletion? (Check if comp state is sent to inventory sync)

---

## Persona 4: THE OWNER/OPERATOR (30+ Years Multi-Venue)

**Profile:** Owns 4 venues. Former fine dining GM, now runs two nightclubs and a restaurant group. Thinks in P&L, labor cost, theft prevention, and scalability. Reads the DSR before anything else. Has fired people for cash handling discrepancies.

**What they test (read ALL code — server, terminal, sync, reports — and look for):**

### P&L Integrity
- Does the DSR match the sum of all individual transactions? (Trace the full path: `pos_orders` → `recalcOrder` → `sessions/close` → `daily_payouts`)
- Is the Liquor Adj Sales formula correct? (Net Sales - Comp Total — check sessions.js)
- Do CC collections by station match the total CC sales? (Check station-level breakdowns in close-day)
- Can paid outs exceed cash in the drawer? (Check if there's a guard or just a warning)
- The Cash Deposit line — is it `cash sales + cash tips - paid outs` or something else? (Check formula)
- If the manager enters a different cash deposit amount, does OVER/SHORT show correctly? (Check manual vs calculated deposit)

### Theft Prevention
- Can a bartender delete a closed transaction? (Check for hard deletes on paid orders)
- Can someone void a paid order? (Check state machine — paid → voided should be blocked or require owner)
- Is there a report showing all voids and comps for the day? (Check audit report endpoint)
- Can a bartender ring items and then void them to pocket cash? (Check void frequency reporting)
- The price override feature — who can use it? Is it logged? (Check permission + audit log)
- Can a bartender create a comp without a reason? (Check if reason is required)

### Labor Cost
- Clock in/out entries — are they synced to Supabase for payroll? (Check sync daemon data types)
- Can a manager clock someone in retroactively? (Check if forced_by allows backdating)
- Declared tips — are they stored and reportable? (Check `declared_tips` column + checkout report)
- Can I see a real-time labor snapshot (who's clocked in, hours worked)? (Check management clock section)

### Scale & Reliability
- If the internet drops for 2 hours, does the POS still work? (Check local-first architecture — all critical paths should work offline)
- When internet returns, does sync catch up cleanly? (Check sync daemon — `synced_at IS NULL` query)
- Can two different dates' data get mixed if the server crosses midnight? (Check date handling in day-close — `businessDate` parameter)
- If I clear test data, does it nuke production data? (Check `/clear-all` endpoint — is it gated?)
- The 30-second sync interval — is it sufficient? What if it fails? (Check retry logic in sync daemon)

### Reporting Depth
- Can I get a product mix report showing what sold, quantities, revenue? (Check product report)
- Can I get hourly sales breakdown to optimize staffing? (Check hourly report)
- Can I see which station (bar) generated the most revenue? (Check station report)
- Can I compare today vs yesterday at a glance? (Check if comparative reports exist)
- Can I export any report as PDF? (Check all PDF endpoints — DSR, checkout, paid-outs, custom, summary, product, hourly, station, employee)

### Booking Integration
- When a reservation is seated, does the POS automatically know the deposit and min spend? (Check `seatFromReservation` → `applyBookingToTab`)
- If a member has a booking, does their name and tier show on the tab? (Check member lookup integration)
- The floor plan — does it refresh automatically? (Check 30-second auto-refresh in `startTableRefresh`)
- Can I see which tables are occupied vs reserved vs open at a glance? (Check floor plan SVG + color coding)

### Day Close Process
- What's the exact sequence? (Map: close all tabs → enter cash deposit → click Close Day → aggregation → daily_payouts push)
- Can I close the day from BOH (Owner portal) instead of the terminal? (Check BOH close day endpoint)
- If Supabase is down during close, does local data survive? (Check close-day — local session saved first, then Supabase push)
- Is there a "reopen day" if I made a mistake? (Look for undo/reopen session logic)

---

## Output Format

Each persona agent returns:

```
## Pressure Test: [PERSONA NAME]

### Critical Failures (blocks service)
1. [description] — [file:line] — [impact]

### Operational Risks (causes confusion or errors)
1. [description] — [file:line] — [impact]

### Missing Features (expected but not present)
1. [description] — [expected behavior]

### UX Friction (slows down staff)
1. [description] — [suggestion]

### Passed Tests (worked as expected)
- [list of scenarios that passed]
```

## Final Combined Report

After all 4 agents complete, compile:

```
## RIDDIM POS Pressure Test Report

### Critical Failures: N
### Operational Risks: N
### Missing Features: N
### UX Friction Points: N

### Priority Fix List
| # | Issue | Source | Severity | Fix Complexity |
|---|-------|--------|----------|----------------|

### Verdict: READY / NOT READY for live service
```
