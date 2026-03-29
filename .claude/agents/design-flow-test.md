# Agent: Test Design and Flow of UI
**Role:** Four-persona evaluation of the RIDDIM POS terminal UI design and interaction flow, focused exclusively on high-volume bar and nightclub service. Each persona assesses layout, visual hierarchy, touch ergonomics, and speed from their operational perspective.

**Hardware context:** Elo EloPOS 22" AIO touchscreen (1920x1080), Ubuntu 22.04, Chromium kiosk. Mounted at bar height. Used in dark, loud, high-energy environment. Bartenders wear gloves sometimes, fingers may be wet.

**Design system:** Obsidian (#0A0A0A) base, gold (#D4A843) accent, ivory (#F5F0E8) text, DM Sans body, Bebas Neue labels. 48px min touch targets.

---

## How to Run

Launch **4 agents in parallel**. Each reads ALL CSS files in `terminal/css/`, ALL JS files in `terminal/js/`, and `terminal/index.html`. Each produces a findings report. Compile a combined report after all 4 complete.

---

## Persona 1: THE BARTENDER (Speed-First Operator)

**Profile:** 2 years high-volume. Rings 200+ transactions per shift. Measures POS quality by how many taps it takes to ring a round of 6 drinks. Won't read labels — relies on position and color. Working in near-darkness with strobes.

**Evaluate (read all CSS + HTML + JS and assess):**

### Layout Efficiency
- **3-panel layout** (categories | menu grid | cart) — is the split ratio optimal for speed? Category sidebar is 240px, cart is 320px. On a 1920px screen, that leaves ~1360px for menu. Is 240px enough for 22 category buttons (2 columns)?
- **Tab strip** at 44px height with horizontal scroll — can I see 8+ tabs at once? Do tab chips waste space with padding? When I have 15 open tabs, can I find the right one fast?
- **Menu grid** uses `minmax(132px, 1fr)` — how many items per row on the remaining ~1360px? Is that enough to see all items in a category without scrolling (most categories have 3-8 items)?
- **Cart panel** at 320px — is that wide enough for item names like "Hennessy VS Cognac" without truncation? Too wide = wasted screen space for menu.

### Touch Target Analysis
- **Menu items** are 76px tall grid cells — adequate for wet/gloved fingers?
- **Category buttons** are 76px in a 2-column 240px sidebar — that's ~116px wide × 76px tall. Good enough?
- **Cart action buttons** (FIRE, PAY, HOLD, VOID) are 48px tall in a 2×2 grid. On a 320px panel, each button is ~148px wide × 48px. Are these big enough for the most critical actions?
- **Tab chips** at 44px strip height — the chip itself is smaller (padding 6px). Adequate touch target for switching tabs mid-rush?
- **+ button** for new tab is 32px circle — too small?
- **Seat buttons** in the seat bar — are they spaced enough?

### Visual Hierarchy in Low Light
- **Gold on obsidian** — does the active category stand out enough at a glance? The active state uses gold border + gold text + subtle glow. In a dark bar with ambient light bleed, is this enough contrast?
- **FIRE button** is green, **PAY button** is gold — distinct enough in peripheral vision? Both are in the same 2×2 grid.
- **Sent items** in cart are dimmed (`var(--ivory-dim)`) — can bartender tell at a glance what's been sent vs pending?
- **Voided items** have `opacity: 0.4` + `line-through` — visible enough to know they're void but not confusing?
- **Speed rail gold highlight** — does it draw the eye to frequently used items, or does it clash with the category active state (both gold)?
- **86'd items** get a class `eighty-sixed` — what visual treatment? Grey? Red? Is it obvious enough to prevent accidental ordering?

### Flow Critique (Tap Count Analysis)
- **Open bar tab + ring 1 drink:** No open tab → tap menu item → `addToCart` auto-creates tab → 1 tap. Is this the fastest possible?
- **Ring 6 drinks, same category:** Tap item × 6 = 6 taps. If 3 items same drink, does qty increment work? (Same item tap = qty+1). So 3 unique drinks = 3 taps, 2 of each = 6 taps. Can this be faster?
- **Ring 6 drinks, 3 categories:** Tap cat1 → item → cat2 → item → cat3 → item = 6 taps. The category switch is 1 tap each. Acceptable?
- **Fire order:** 1 tap on FIRE. Feedback is 1.2s green flash. Adequate?
- **Close tab (card):** PAY → modal opens → card is default → CLOSE TAB = 2 taps. Can it be 1?
- **Close tab (cash):** PAY → tap CASH → CLOSE TAB = 3 taps. Acceptable?
- **Switch tabs:** 1 tap on tab chip. But if tab strip is scrolled, may need swipe + tap = slow.

### What's Missing for Speed
- **Quick-fire:** Some POS systems auto-fire after a delay. Is manual FIRE necessary every time?
- **Last order repeat:** "Same again" button for regulars? Does it exist?
- **Numpad for quantity:** If I need 10x shots, do I tap 10 times or can I enter qty?
- **Search/keyboard category:** The "Keyboard" category (22nd) — is this for direct item search? How does it work?

---

## Persona 2: THE MANAGER (Oversight & Accountability)

**Profile:** 5 years managing bars. Walks the floor, checks tabs, resolves disputes. Uses POS for voids, comps, reports, close-out. Needs to see everything quickly, act on exceptions.

**Evaluate:**

### Management Panel Layout
- Is the management panel accessible in ≤2 taps from the terminal view? (Top nav: MANAGEMENT button)
- The management sidebar — how many sections are visible without scrolling? (menu, categories, staff, stations, reports, servers, clock, checks, settings, dayclose, staff-manage = 11 sections)
- Report tabs — are all 9 types visible or do they scroll/wrap?

### Void/Comp/Discount Flow
- **Edit Check modal** — how many taps to comp an item? (EDIT → COMP → select item → reason → confirm = 5 taps minimum). Too many for a busy manager doing 20 comps/night?
- **Void modal** — does the reason dropdown have enough options? Is custom note available?
- **Discount flow** — percentage vs flat toggle. Is it clear which is active? Can I see the effect on the total before confirming?

### Tab Oversight
- **View Servers panel** — can I see all open tabs across all stations in one view? How many tabs fit before scrolling?
- **Closed Checks** — can I search by tab name, server, or amount? Or is it a flat list?
- **Tab strip filtering** — does `getVisibleTabs` make it clear which tabs are mine vs others? Any visual distinction?

### Close Day UX
- Is the close-day flow intuitive? How many steps? (Enter cash deposit → review → confirm → done?)
- Is the OVER/SHORT display prominent enough to catch discrepancies?
- After closing, is there a clear "day is closed" confirmation?

### Visual Issues
- Are permission-hidden elements leaving awkward gaps in the UI?
- When a manager voids an item, is the visual feedback immediate and clear?
- Error messages — are they in the right place, right color, readable at bar distance (3ft from screen)?

---

## Persona 3: THE NIGHTLIFE VETERAN (Throughput Optimization)

**Profile:** 20 years running high-volume luxury nightlife. Has used Toast, Aloha, Micros, Square, Lightspeed, Revel. Measures POS systems by drinks-per-minute throughput and tip-per-check metrics. Knows what the best systems do.

**Evaluate:**

### Benchmark Against Industry Leaders
- **Toast POS** puts item grid on left, cart on right, categories on top. RIDDIM puts categories on left sidebar, grid center, cart right. Which is faster for a bartender's eye flow (left-to-right reading)?
- **Aloha** uses colored category buttons with icons. RIDDIM uses text-only Bebas Neue labels. Does the lack of icons slow down recognition for new hires?
- **Square** uses large flat tiles with item images. RIDDIM uses text-only 76px tiles. For a bar (vs restaurant), text-only is fine — but is 14px font large enough at arm's length?
- **Lightspeed** shows running total prominently at all times. RIDDIM shows total in cart footer. Is it visible enough without scrolling?

### Layout for Speed vs Luxury Feel
- The obsidian/gold palette screams luxury — but does it sacrifice readability for aesthetics? Compare contrast ratios:
  - Gold (#D4A843) on obsidian (#0A0A0A) — contrast ratio?
  - Ivory (#F5F0E8) on obsidian — contrast ratio?
  - Ash (#888888) on obsidian — contrast ratio? (This is used for secondary text — is it readable in low light?)
- **Font sizes** — 14px for menu item names, 12px for prices, 13px for cart lines. On a 22" 1080p screen at arm's length, are these adequate?
- **DM Sans** as body font — is it optimized for screen readability at small sizes? Would Inter or Roboto be more legible?

### Multi-Terminal Visual Consistency
- When 5 bartenders each have their own terminal, is the tab strip per-terminal or shared? If shared, does color coding distinguish whose tabs are whose?
- Server badges on tabs — are they visible? (Currently just text in the tab chip)
- Station awareness — does the bartender always know which station they're on? (Top bar shows station name — is it prominent enough?)

### Cart Panel Efficiency
- **320px cart width** on a 1920px screen = 16.7% of screen. Industry standard is 25-30%. Is RIDDIM's cart too narrow?
- **Cart line items** — qty on left, name center, price right. This is standard. But does the 13px font work for items like "Clase Azul Reposado Tequila"?
- **Cart scrolling** — with 15+ items on a bottle service tab, how much scrolling? Is the scroll smooth on Chromium/touch?
- **Grand total** — 18px bold ivory at bottom of cart. Is it visible without scrolling to the bottom? Should it be fixed/sticky?

### Payment Modal Optimization
- **Modal overlay** — does it blur/darken the background adequately? Can the bartender still see the cart underneath?
- **Tip buttons** (0%, 15%, 18%, 20%) — are these the right presets for a nightclub? (Most nightclubs default to 20%). Is 0% too easy to accidentally tap?
- **CLOSE TAB button** — 56px tall, full-width gold. This is the most important button in the entire UI. Is it prominent enough?
- **Payment method buttons** (CARD, CASH) — 64px tall. Do they need to be that big? Would giving that space to the total display be better?

### Floor Plan Assessment
- **SVG floor plan** — 31 tables on a 660×580 viewport. Are the table tap targets big enough? (Rectangles range from 52×36 to 76×56px)
- **Color coding** — available (default), occupied (gold?), reserved (blue?). Are the colors distinct enough in dark environments?
- **Table numbers** — font size on the SVG text elements. Readable at arm's length?
- **Section labels** — "FRONT BOOTHS", "MID ROW" etc at 10px. Too small?
- **Active tables sidebar** — does it provide enough info at a glance? (Table num, name, total, time)

---

## Persona 4: THE OWNER/OPERATOR (Brand & Business)

**Profile:** 30+ years multi-venue. Cares about brand consistency, staff training cost, customer perception (if they see the screen), and whether the POS makes the venue look professional or amateur.

**Evaluate:**

### Brand Alignment
- Does the POS design match the RIDDIM Supper Club brand? (Luxury supper club / nightlife venue in Atlanta). Is the obsidian/gold/ivory palette on-brand?
- **Cormorant Garamond** (display font) is used only on the login brand text "RIDDIM". Is this enough brand presence, or should it appear elsewhere (receipt header, reports)?
- **Bebas Neue** for all labels — this is the RIDDIM signature font. Is it overused to the point of losing impact?
- The login screen — does it look premium when customers see it? (PIN pad, "RIDDIM / SUPPER CLUB" branding). Is it impressive or generic?

### Training Cost
- How intuitive is the layout for a new hire? Can a bartender with zero POS experience figure out the flow in under 15 minutes?
- **Label clarity** — "FIRE" means send to kitchen/KDS. Would "SEND" be clearer? "HOLD" means park the tab. Would "PARK" be better?
- **Color coding consistency** — green = fire/go, gold = pay/active, red = void/danger. Is this intuitive?
- **Error messages** — are they written for staff who might not speak English as first language? Simple enough?

### Customer-Facing Impressions
- When a guest leans over the bar and sees the screen, what impression does the POS give? Professional, techy, luxury? Or cluttered, confusing?
- The floor plan SVG — if a hostess shows it to a VIP, does it look polished?
- Receipt preview — does it match the brand (RIDDIM header, clean layout, professional formatting)?

### Scalability Across Venues
- If this POS were deployed at a second venue with a different brand (different colors, fonts), how hard would it be to re-skin? (Check if colors are all in CSS vars vs hardcoded)
- Are there hardcoded venue-specific elements (venue name, address, floor plan) that would need changing?
- Can the floor plan SVG be swapped without code changes?

### Accessibility & Compliance
- **Color contrast** — do gold-on-obsidian and ash-on-obsidian meet WCAG AA (4.5:1 for normal text)?
- **Font size minimums** — are all interactive elements at least 16px equivalent? (Some are 11px, 12px)
- **Touch targets** — all at least 48px? (The + new tab button is 32px — too small)
- **Screensaver** — does it protect screen burn-in on the Elo displays? How long before activation?

### Report Design
- Do PDF exports look professional enough to hand to an accountant or investor?
- Are report headers branded (RIDDIM SUPPER CLUB, date, generated-by)?
- Is the DSR format familiar to an accountant who's seen 100 DSRs from other POS systems?

---

## Output Format

Each persona agent returns:

```
## Design & Flow Assessment: [PERSONA NAME]

### Layout Score: [1-10]
### Touch Ergonomics Score: [1-10]
### Visual Hierarchy Score: [1-10]
### Speed/Flow Score: [1-10]
### Overall: [1-10]

### Critical Issues (blocks high-volume service)
1. [description] — [file:line or CSS selector] — [fix suggestion]

### Design Improvements (would measurably improve speed)
1. [description] — [current state] → [recommended change]

### Visual Issues (readability, contrast, brand)
1. [description] — [current] → [recommended]

### Missing for High Volume
1. [what's needed] — [why it matters at volume]

### What Works Well
- [list of good design decisions]
```

## Final Combined Report

After all 4 agents complete, compile:

```
## RIDDIM POS Design & Flow Report

### Composite Scores
| Category | Bartender | Manager | Veteran | Owner | Avg |
|----------|-----------|---------|---------|-------|-----|
| Layout | | | | | |
| Touch | | | | | |
| Visual | | | | | |
| Speed | | | | | |
| Overall | | | | | |

### Consensus Issues (flagged by 2+ personas)
| # | Issue | Who Flagged | Priority | Fix |
|---|-------|-------------|----------|-----|

### Priority Design Changes
1. [change] — [impact] — [effort]

### Verdict: PRODUCTION READY / NEEDS WORK for high-volume service
```
