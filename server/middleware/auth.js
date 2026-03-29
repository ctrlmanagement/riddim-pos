/* RIDDIM POS — Server-Side Permission Middleware
 *
 * Validates staff_id from request body or x-staff-id header,
 * looks up their security group, and checks the required permission.
 *
 * Usage: router.post('/sensitive', requirePermission('order.void_line'), handler)
 */
'use strict';

const pool = require('../db/pool');

// Cache: staff_id -> { groupId, groupName, permissions: Set, cachedAt }
const staffCache = new Map();
const CACHE_TTL = 60_000; // 1 minute

async function getStaffPermissions(staffId) {
  const cached = staffCache.get(staffId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) return cached;

  // Look up staff's security group from local mirror (synced from Supabase)
  // Fall back to direct Supabase query if local table doesn't exist
  let groupId = null;
  let groupName = null;

  try {
    const { rows } = await pool.query(
      `SELECT s.security_group_id, g.name as group_name
       FROM staff s
       LEFT JOIN pos_security_groups g ON g.id = s.security_group_id
       WHERE s.id = $1`,
      [staffId]
    );
    if (rows[0]) {
      groupId = rows[0].security_group_id;
      groupName = (rows[0].group_name || '').toLowerCase();
    }
  } catch (e) {
    // staff table might not be in local PG — that's OK, fall through
  }

  // Load permissions from local pos_security_permissions table
  let permissions = new Set();
  if (groupId) {
    try {
      const { rows } = await pool.query(
        `SELECT permission FROM pos_security_permissions WHERE group_id = $1 AND enabled = true`,
        [groupId]
      );
      permissions = new Set(rows.map(r => r.permission));
    } catch (e) {
      // Table might not be in local PG — fall through with empty permissions
    }
  }

  // Owner group always has all permissions
  if (groupName === 'owner') {
    permissions.add('*');
  }

  const entry = { groupId, groupName, permissions, cachedAt: Date.now() };
  staffCache.set(staffId, entry);
  return entry;
}

function isOwnerGroup(groupName) {
  return groupName === 'owner';
}

// Middleware factory: requirePermission('order.void_line')
function requirePermission(permission) {
  return async (req, res, next) => {
    const staffId = req.body.staff_id || req.body.voided_by || req.body.comped_by ||
                    req.body.processed_by || req.body.closed_by ||
                    req.headers['x-staff-id'];

    if (!staffId) {
      // No staff context — allow (backward compat for internal/sync calls)
      return next();
    }

    try {
      const staff = await getStaffPermissions(staffId);
      if (staff.permissions.has('*') || staff.permissions.has(permission)) {
        req.staffAuth = staff;
        return next();
      }
      return res.status(403).json({ error: `Permission denied: ${permission}` });
    } catch (err) {
      // If permission lookup fails, allow through (local-first — don't block POS)
      console.warn('[auth] Permission lookup failed, allowing through:', err.message);
      return next();
    }
  };
}

// Middleware: requireOwner — for destructive operations
function requireOwner() {
  return async (req, res, next) => {
    const staffId = req.body.staff_id || req.body.closed_by || req.headers['x-staff-id'];
    if (!staffId) {
      return res.status(400).json({ error: 'staff_id required for this operation' });
    }

    try {
      const staff = await getStaffPermissions(staffId);
      if (isOwnerGroup(staff.groupName)) {
        req.staffAuth = staff;
        return next();
      }
      return res.status(403).json({ error: 'Owner permission required' });
    } catch (err) {
      console.warn('[auth] Owner check failed, denying:', err.message);
      return res.status(403).json({ error: 'Permission check failed' });
    }
  };
}

// Clear cache (called when permissions are updated)
function clearCache() {
  staffCache.clear();
}

module.exports = { requirePermission, requireOwner, clearCache, getStaffPermissions };
