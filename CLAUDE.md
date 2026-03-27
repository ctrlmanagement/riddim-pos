# RIDDIM POS — Claude Code Project Context
**AG Entertainment | S79 | March 26, 2026**

## What This Project Is
Custom point-of-sale system for RIDDIM Supper Club (Atlanta, GA). Local-first architecture: on-premise server + Android tablet terminals. Integrates with the existing RIDDIM Supabase backend (51 tables — membership, inventory, P&L, events, bookings, ticketing).

**Repo:** `https://github.com/ctrlmanagement/riddim-pos` (PRIVATE)
**Parent project:** `https://github.com/ctrlmanagement/RiddimSupperClub`
**Supabase project:** `cbvryfgrqzdvbqigyrgh` (shared with RIDDIM platform)
**Working directory:** `~/ctrl/riddim-pos`

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CLOUD (Supabase)                   │
│  Members, Events, Menu, Inventory, P&L, Bookings    │
│  51 existing tables + ~11 new POS tables             │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS sync (app-level)
                       │ Supabase Realtime (menu/member updates)
┌──────────────────────┴──────────────────────────────┐
│              LOCAL SERVER (Mac Mini M4)               │
│  Node.js + PostgreSQL                                │
│  Order engine, tab management, payment processing    │
│  Socket.IO hub for all terminals                     │
└──────┬───────┬───────┬───────┬───────┬──────────────┘
       │       │       │       │       │  LAN (Socket.IO)
    ┌──┴──┐ ┌──┴──┐ ┌──┴──┐ ┌──┴──┐ ┌──┴──┐
    │BAR1 │ │BAR2 │ │BAR3 │ │BAR4 │ │ SVC │  Android tablets
    └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  (WebView terminal)
                       │
                    ┌──┴──┐
                    │ KDS │  Kitchen/Bar display
                    └─────┘
```

## Technology Stack
| Layer | Technology |
|---|---|
| Local Server | Node.js + Express + Socket.IO |
| Local Database | PostgreSQL 16 |
| Cloud Database | Supabase PostgreSQL (shared with RIDDIM platform) |
| Sync | Application-level (Node.js daemon, HTTPS to Supabase) |
| Terminal App | Android WebView hybrid (HTML/CSS/JS served by local server) |
| Payment | Stripe Terminal SDK (Android) |
| Printing | ESC/POS via Star Micronics / Epson SDK |
| KDS | WebView on Android tablet, Supabase Realtime |
| Hardware | Sunmi T3 Pro Max (terminals), Stripe Reader S700 |

## Folder Structure
```
riddim-pos/
├── server/           # Node.js local server (order engine, sync, Socket.IO)
├── terminal/         # Staff-facing terminal UI (HTML/CSS/JS, served via WebView)
├── kds/              # Kitchen/Bar display system
├── docs/             # Architecture docs, specs
├── _reference/       # Odoo POS source for study (not deployed)
│   └── odoo-pos/     # addons/point_of_sale + pos_restaurant
└── .claude/agents/   # POS-specific Claude agents
```

## BAR_CONFIG (from RIDDIM — canonical)
```javascript
const BAR_CONFIG = [
  { id:'LR',    label:'Liquor Room', pos:null,    active:true  },
  { id:'BAR1',  label:'Bar 1',       pos:'POS 1', active:true  },
  { id:'BAR2',  label:'Bar 2',       pos:'POS 2', active:true  },
  { id:'BAR3',  label:'Bar 3',       pos:'POS 3', active:true  },
  { id:'BAR4',  label:'Bar 4',       pos:'POS 4', active:true  },
  { id:'BAR5',  label:'SVC',         pos:'POS 7', active:true  },
];
```

## Design System (inherited from RIDDIM)
| Token | Value |
|---|---|
| `--color-obsidian` | `#0A0A0A` |
| `--color-gold-warm` | `#D4A843` |
| `--color-ivory` | `#F5F0E8` |
| `--color-ash` | `#888888` |
| Display font | Cormorant Garamond |
| Label font | Bebas Neue |
| Body font | DM Sans |

## Integration Points (existing RIDDIM tables)
| System | Key Tables | POS Connection |
|---|---|---|
| Inventory | inv_products (has `pos_item_id`), inv_counts, inv_stock_ups | Sales → theoretical usage |
| P&L | daily_payouts (date+label key), pl_revenue | Auto-populate 11 DSR fields |
| Members | members, points_ledger | Lookup at terminal, spend tracking, points |
| Table Bookings | table_bookings, table_sessions | Tab linked to booking, min spend tracking |
| Events | events, tickets | Event menus, ticket scan → tab |
| Staff | staff (inv_staff), scheduling | Clock in/out, server assignment, tips |

## Permanent Constraints
1. **Local-first.** POS must operate with zero internet. Cloud sync is secondary.
2. **BAR_CONFIG is canonical.** Terminal stations derive from it. Never hardcode locations.
3. **Card data never touches our system.** Stripe Terminal handles PCI. Store only PaymentIntent IDs.
4. **daily_payouts date+label key is sacred.** POS writes into existing P&L structure, not a parallel one.
5. **pos_item_id on inv_products is the bridge.** Menu items link to inventory products through this FK.
6. **Same Supabase project.** POS tables live alongside the existing 51 tables in `cbvryfgrqzdvbqigyrgh`.
7. **RIDDIM design system applies.** Obsidian/gold/ivory palette, Bebas Neue labels, DM Sans body.
8. **Deposit is a split payment.** Payment #1 = deposit, #2 = balance. Unused deposit → OTHER INCOME. (S79)
9. **Tab/session not created until first item or reservation seat.** No blank tables in DB. (S79)
10. **Min spend includes tax, no gratuity.** Subtotal + tax determines minimum met. (S79)
11. **tab.reopen_deposit is separate from tab.reopen.** Owner-only by default. (S79)
12. **booking_id stored on pos_orders.** Required for deposit to survive terminal restart. (S79)
13. **Reopen permissions checked live from Supabase.** Not from login-time cache. (S79)

## Research Briefs
Located at `~/ctrl/riddimsupperclub/_briefings/pos-system/`:
| File | Domain |
|---|---|
| POS_Core_Engine_Architecture_Brief.md | Order state machine, tabs, kitchen routing |
| Payment_Processing_Hardware_Briefing.md | Stripe Terminal, Sunmi hardware, PCI, tips |
| POS_Local_Server_Architecture_v1.md | Local PG, sync to Supabase, Socket.IO, offline |
| Android_Terminal_KDS_Briefing_v1.md | WebView hybrid, KDS, printing, bar UI |
| POS_Integration_Map_v1.md | Mapping to existing 51 tables, new tables, workflows replaced |

## Build Priority
Start staff-facing (terminal UI), build the middle (server), connect outward (sync + integrations).

Phase 1: Terminal UI — COMPLETE (S74-S76)
Phase 2: Local server — COMPLETE (S78)
Phase 2.5: RIDDIM integration — COMPLETE (S79) — table_sessions, reservations, members, deposits
Phase 3: Payment — Stripe Terminal integration
Phase 4: KDS — kitchen/bar display routing
Phase 5: Sync — COMPLETE (S80) — local PG → Supabase every 30s, 7 data types
Phase 5.5: Paid outs + P&L export — COMPLETE (S81) — paid out recording, day close → daily_payouts, reports, PDF engine
Phase 6: Integration — inventory, P&L auto-connect (core P&L done, inventory pending)
