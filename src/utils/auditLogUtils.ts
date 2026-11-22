import { StaffAuditLog, StaffMember } from '../types';

export interface MinimalAuditUser {
  id?: string;
  name?: string;
  role?: string;
}

export interface AuditActor {
  staffId: string;
  staffName: string;
  staffRole: string;
}

const DUMMY_AUDIT_LOG_IDS = new Set(['log-1', 'log-2', 'log-3', 'log-4', 'log-5']);

/**
 * Resolve the canonical (staffId, staffName, staffRole) actor for an audit trail entry.
 * Priority:
 *  1. Explicit actingStaff object (e.g., Operator B verified via PIN on Operator A's device)
 *  2. Explicit staffName resolved against staffMembers roster (or Manager Override / currentUser)
 *  3. Active terminal operator (activePOSStaff || activeStaffUser)
 *  4. Logged-in owner / admin user fallback
 */
export const resolveAuditActor = (params: {
  actingStaff?: StaffMember | null;
  staffName?: string | null;
  staffIdHint?: string | null;
  staffMembers?: StaffMember[];
  activeOperator?: StaffMember | null;
  currentUser?: MinimalAuditUser | null;
}): AuditActor => {
  const {
    actingStaff,
    staffName,
    staffIdHint,
    staffMembers = [],
    activeOperator,
    currentUser,
  } = params;

  if (actingStaff && actingStaff.id && actingStaff.name) {
    return {
      staffId: actingStaff.id,
      staffName: actingStaff.name,
      staffRole: actingStaff.role || 'staff',
    };
  }

  const trimmedIdHint = String(staffIdHint || '').trim();
  if (trimmedIdHint) {
    const byId = staffMembers.find(s => s.id === trimmedIdHint);
    if (byId) {
      return {
        staffId: byId.id,
        staffName: byId.name,
        staffRole: byId.role || 'staff',
      };
    }
    if (activeOperator && activeOperator.id === trimmedIdHint) {
      return {
        staffId: activeOperator.id,
        staffName: activeOperator.name,
        staffRole: activeOperator.role || 'staff',
      };
    }
  }

  const trimmedName = String(staffName || '').trim();
  if (trimmedName) {
    const normalizedName = trimmedName.toLowerCase();

    const matchedRoster = staffMembers.find(
      s =>
        String(s.name || '').trim().toLowerCase() === normalizedName ||
        String(s.employeeCode || '').trim().toLowerCase() === normalizedName
    );
    if (matchedRoster) {
      return {
        staffId: matchedRoster.id,
        staffName: matchedRoster.name,
        staffRole: matchedRoster.role || 'staff',
      };
    }

    if (
      activeOperator &&
      String(activeOperator.name || '').trim().toLowerCase() === normalizedName
    ) {
      return {
        staffId: activeOperator.id,
        staffName: activeOperator.name,
        staffRole: activeOperator.role || 'staff',
      };
    }

    if (normalizedName === 'manager' || normalizedName === 'manager override') {
      return {
        staffId: 'manager-override',
        staffName: 'Manager Override',
        staffRole: 'manager',
      };
    }

    if (
      currentUser?.name &&
      String(currentUser.name).trim().toLowerCase() === normalizedName
    ) {
      return {
        staffId: currentUser.id || 'usr-admin-1',
        staffName: currentUser.name,
        staffRole: currentUser.role || 'owner',
      };
    }

    const fallbackId =
      trimmedIdHint ||
      `operator-${normalizedName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'staff'}`;
    return {
      staffId: fallbackId,
      staffName: trimmedName,
      staffRole: 'staff',
    };
  }

  if (activeOperator && activeOperator.id && activeOperator.name) {
    return {
      staffId: activeOperator.id,
      staffName: activeOperator.name,
      staffRole: activeOperator.role || 'staff',
    };
  }

  return {
    staffId: currentUser?.id || 'usr-admin-1',
    staffName: currentUser?.name || 'Restaurant Owner',
    staffRole: currentUser?.role || 'owner',
  };
};

/**
 * Format a context note when an action was authorized by Operator B on Operator A's terminal.
 */
export const formatTerminalContextSuffix = (
  actor: AuditActor,
  deviceOperator?: StaffMember | null
): string => {
  if (
    deviceOperator &&
    deviceOperator.id &&
    actor.staffId &&
    actor.staffId !== deviceOperator.id
  ) {
    return ` [Authorized on ${deviceOperator.name}'s terminal]`;
  }
  return '';
};

/**
 * Normalize a raw Firestore or localStorage audit log document so malformed records never crash UI rendering.
 */
export const normalizeAuditLogEntry = (raw: Partial<StaffAuditLog> & { id?: string }): StaffAuditLog => {
  const ts = typeof raw.timestamp === 'number' && !Number.isNaN(raw.timestamp)
    ? raw.timestamp
    : Date.now();
  return {
    id: String(raw.id || `log-${ts}-${Math.floor(Math.random() * 1000)}`),
    timestamp: ts,
    staffId: String(raw.staffId || 'unknown-staff'),
    staffName: String(raw.staffName || 'Staff'),
    staffRole: String(raw.staffRole || 'staff'),
    actionType: (raw.actionType || 'staff_updated') as StaffAuditLog['actionType'],
    targetEntityId: raw.targetEntityId ? String(raw.targetEntityId) : undefined,
    targetEntityName: raw.targetEntityName ? String(raw.targetEntityName) : undefined,
    details: String(raw.details || ''),
    reason: raw.reason ? String(raw.reason) : undefined,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : undefined,
  };
};

/**
 * Filter out legacy dummy entries, deduplicate by ID, merge optimistic recent local logs with cloud snapshot,
 * and sort descending by timestamp (newest first), capped at maxEntries.
 */
export const mergeAndSortAuditLogs = (
  primaryLogs: StaffAuditLog[],
  secondaryLogs: StaffAuditLog[] = [],
  maxEntries: number = 500
): StaffAuditLog[] => {
  const byId = new Map<string, StaffAuditLog>();

  for (const item of secondaryLogs) {
    if (!item || !item.id || DUMMY_AUDIT_LOG_IDS.has(item.id)) continue;
    byId.set(item.id, normalizeAuditLogEntry(item));
  }

  for (const item of primaryLogs) {
    if (!item || !item.id || DUMMY_AUDIT_LOG_IDS.has(item.id)) continue;
    byId.set(item.id, normalizeAuditLogEntry(item));
  }

  return Array.from(byId.values())
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, maxEntries);
};

export const isDummyAuditLog = (log: Partial<StaffAuditLog>): boolean => {
  return Boolean(log?.id && DUMMY_AUDIT_LOG_IDS.has(log.id));
};
