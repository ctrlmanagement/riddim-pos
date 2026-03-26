# Session Briefing — S77: BOH Portal & Security System
**Date:** March 26, 2026
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`) + RIDDIM Platform (`~/ctrl/riddimsupperclub`)
**Branch:** `main` (both repos)
**Commits this session:** `7f60e87` (riddimsupperclub), none in riddim-pos (architecture + schema session)

---

## Session Summary

Designed and built the POS security/permissions system and the BOH (Back Office) portal. Started with an architectural discussion about where BOH features should live — decided on a separate portal (`docs/boh/`) in the riddimsupperclub repo with Google OAuth, not embedded in the FOH terminal or Owner Portal. Built the Supabase schema for security groups and permissions, then shipped the BOH portal scaffold with fully functional security group management and staff role assignment.

**Starting state:** FOH terminal complete (S76), BOH builder agent created, no BOH UI, no security/permissions system.

**Ending state:** Security groups + permissions live in Supabase (7 groups, 39 permissions each), BOH portal deployed with security group CRUD and staff assignment, Owner Portal has POS preview tab in Finance section.

---

## Key Architecture Decisions

### 1. BOH is a Separate Portal, Not Part of FOH or Owner Portal
- **Decision:** Create `docs/boh/index.html` as the 5th RIDDIM portal
- **Why:** BOH needs manager access (not just owner), the Owner Portal is already 6.6K+ lines, and BOH will grow large with reports/audit/transactions
- **Pattern:** Same as Inventory Portal — Google OAuth, standalone HTML, Supabase-direct

### 2. Portal Responsibilities Split
| System | Responsibility |
|---|---|
| **Owner Portal** | P&L overview, membership, events, bookings + POS preview tab |
| **BOH Portal** | All POS administration: security, staff, products, config, audit, transactions, reports |
| **FOH Terminal** | Runtime order flow only — reads config/menu/roles from Supabase, basic management scoped by permissions |

### 3. Security System: Named Groups + Granular Permissions
- Modeled on HotSauce BackOffice Security Setup (3 screenshots analyzed)
- **Pattern:** Security groups (Barback, Bartender, Cashier, GM, Hostess, Kitchen, Manager) with per-group permission toggles
- **Schema:** `pos_security_groups` → `pos_security_permissions` (group_id + permission key + enabled boolean)
- **Staff link:** `staff.security_group_id` FK to groups table
- **Terminal reads:** Employee's group permissions loaded at login, cached as a `Set`, checked via `hasPermission(key)`
- **Replaces:** `pos_role` field + `require_manager_*` config flags (kept for backward compatibility during transition)

### 4. Products/Menu CRUD Migrates to BOH
- Currently in terminal `mgmt-menu.js` / `mgmt-categories.js`
- Will move to BOH Portal products page
- Terminal keeps read-only access or quick-edit gated by permissions

---

## What Was Built

### Supabase Schema (SQL executed)

```sql
-- New tables
CREATE TABLE pos_security_groups (
    id uuid PRIMARY KEY, name text UNIQUE, description text,
    is_default boolean, created_at timestamptz, updated_at timestamptz
);

CREATE TABLE pos_security_permissions (
    id uuid PRIMARY KEY, group_id uuid FK, permission text,
    enabled boolean, UNIQUE(group_id, permission)
);

-- Staff table modification
ALTER TABLE staff ADD COLUMN security_group_id uuid REFERENCES pos_security_groups(id);

-- RLS policies
CREATE POLICY "Allow all access to pos_security_groups" ON pos_security_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to pos_security_permissions" ON pos_security_permissions FOR ALL USING (true) WITH CHECK (true);

-- Seeded 7 default groups with 39 permissions each (273 permission rows)
```

### Permission Keys (39 total, 6 categories)

| Category | Keys | Count |
|---|---|---|
| Orders | `order.create`, `.modify`, `.void_line`, `.void_tab`, `.comp`, `.discount`, `.remove_void_comp`, `.fire`, `.reprint_kitchen` | 9 |
| Tabs & Tables | `tab.open`, `.close`, `.hold`, `.reopen`, `.transfer_table`, `.transfer_guest`, `.combine`, `.edit_name`, `.set_gratuity`, `.remove_tax` | 10 |
| Payments | `pay.card`, `.cash`, `.comp`, `.change_tip`, `.reprint_receipt` | 5 |
| Floor & Service | `floor.view_all_tables`, `.fast_bar`, `.bottle_service`, `.86_toggle` | 4 |
| Clock & Checkout | `clock.in_out`, `.force_out`, `.view_others`, `.checkout` | 4 |
| Management | `mgmt.access`, `.view_servers`, `.view_sales`, `.view_employee_reports`, `.edit_menu`, `.edit_config`, `.close_day` | 7 |

### Default Group Permissions

| Group | Enabled | Profile |
|---|---|---|
| Barback | 4/39 | Create orders, fire, clock in/out |
| Bartender | 15/39 | Full order flow, tabs, payments, floor, clock |
| Cashier | 9/39 | Create orders, payments, open/close tabs |
| Hostess | 5/39 | Floor view, open tabs, edit names, clock |
| Kitchen | 2/39 | Clock in/out only |
| Manager | 37/39 | Everything except edit_config and close_day |
| GM | 39/39 | Full access |

### BOH Portal (`riddimsupperclub/docs/boh/index.html`) — 819 lines

- Google OAuth login (same client ID + OWNER_EMAILS whitelist as other portals)
- Auto-session restore (skips login if already authenticated)
- 7-section top nav: Security, Staff, Products, Config, Audit, Transactions, Reports
- Mobile responsive bottom nav
- **Security Groups page (functional):**
  - Card grid showing all groups with name, description, permission progress bar (e.g. 15/39)
  - DEFAULT badge on default group
  - Click card → edit modal with full 39-permission checkbox matrix organized by 6 categories
  - Each permission shows label + monospace key (e.g. `order.void_line`)
  - Toggle switches for enable/disable
  - Create new groups via "+ New Group" button
- **Staff page (functional):**
  - Data table: Employee, Role, Security Group (gold badge), PIN (masked), Status (active/inactive badge), Edit button
  - Edit modal: security group dropdown, 4-digit PIN input
  - Saves `security_group_id` + backward-compatible `pos_role` mapping
- **5 placeholder sections:** Products, Config, Audit, Transactions, Reports — scaffolded with "Coming Soon"
- RIDDIM design system: obsidian/gold/ivory, Bebas Neue labels, DM Sans body, print CSS
- Toast notifications for success/error feedback

### Owner Portal POS Tab (`riddimsupperclub/docs/owner/index.html`) — 86 lines added

- Added "POS" to Finance nav group (desktop + mobile)
- POS tab panel with 5 preview cards: Security & Staff, Products & Menu, Audit & Transactions, Reports & P&L, Configuration
- Live stat badges from Supabase: group count, staff count, item count, category count, station count
- Gold gradient "Open POS Back Office" button linking to `../boh/index.html`

---

## Current Portal Map

```
portal.ctrlmanagement.com/
├── owner/index.html       # Owner Portal (Google OAuth) — 6.7K lines
├── staff/index.html       # Staff Portal (phone OTP) — 3.5K lines
├── members/index.html     # Members Portal (phone OTP) — 2.2K lines
├── inventory/index.html   # Inventory Portal (Google OAuth) — 1.4K lines
└── boh/index.html         # BOH Portal (Google OAuth) — 819 lines ★ NEW
```

---

## What's Next

> **Resume at commit `7f60e87` (riddimsupperclub) / `180b13e` (riddim-pos) on main.**

### Immediate — Next Session
1. **Wire `hasPermission()` into FOH terminal** — Load security_group_id + permissions at login, gate all actions, hide unauthorized UI elements
2. **BOH Products page** — Menu item CRUD, categories, pricing (migrate from terminal mgmt-menu.js)
3. **BOH Config page** — Tax, tips, stations, manager gates, receipt footer

### Then
4. **Local server (Phase 2)** — Node.js + Express + Socket.IO + local PostgreSQL
5. **BOH Audit Trail** — Surface void/comp/discount logs (needs transaction data from server)
6. **BOH Transaction Lookup** — Searchable tab history (needs transaction data from server)
7. **BOH Reports** — Sales, employee, product mix, operating, P&L integration
8. **KDS** — Kitchen/bar display routing
9. **Stripe Terminal** — Card reader on Sunmi T3
10. **Supabase sync** — Local PG ↔ Supabase bidirectional

---

## Reference Material

- **HotSauce BOH screenshots:** `Screen/boh/` directory (BackOffice v7.3.1 — Employee, Security Setup, Security Groups)
- **Hot Door FOH screenshots:** `Screen/` directory (27 PNGs)
- **Research briefs:** `~/ctrl/riddimsupperclub/_briefings/pos-system/` (5 architecture briefs)
- **Supabase schema snapshot:** `~/ctrl/riddimsupperclub/_reference/schema_snapshot_pre_pos_2026-03-25.csv`
- **S76 briefing:** `_briefings/S76_POS_Terminal_Build_2026-03-26.md` (FOH terminal build)
