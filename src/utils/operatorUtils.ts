import { StaffMember } from '../types';

export const PLACEHOLDER_OPERATOR_LABELS = new Set([
  'restaurant owner',
  'restaurant owner (admin)',
  'admin',
  'staff',
  'guest user',
  'owner',
  'store manager',
]);

export interface MinimalUserContext {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  role: 'super_admin' | 'admin' | 'owner' | 'sales' | 'inventory' | 'accountant';
  branchId: string;
}

export const isPlaceholderOperatorName = (name?: string | null): boolean => {
  const cleaned = String(name || '').trim().toLowerCase();
  if (!cleaned) return true;
  return PLACEHOLDER_OPERATOR_LABELS.has(cleaned);
};

export const parseCachedStaffSession = (raw: string | null | undefined): StaffMember | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StaffMember;
    if (parsed && parsed.id && parsed.name) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
};

export const buildUserContextFromStaff = (staff: StaffMember): MinimalUserContext => {
  const roleStr = String(staff.role || '').toLowerCase();
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email || `${staff.username || staff.employeeCode}@quickims.np`,
    role: roleStr.includes('manager') || roleStr.includes('admin') ? 'admin' : 'sales',
    branchId: 'wh-main',
  };
};

export const resolveActiveOperator = (
  activePOSStaff?: StaffMember | null,
  activeStaffUser?: StaffMember | null
): StaffMember | null => {
  return activePOSStaff || activeStaffUser || null;
};

export const resolveOperatorIdentity = (
  activePOSStaff?: StaffMember | null,
  activeStaffUser?: StaffMember | null,
  currentUser?: { id?: string; name?: string; role?: string } | null
): { operatorId: string; operatorName: string; operatorRole: string } => {
  const operator = resolveActiveOperator(activePOSStaff, activeStaffUser);
  if (operator) {
    return {
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role || 'staff',
    };
  }
  return {
    operatorId: currentUser?.id || 'usr-admin-1',
    operatorName: currentUser?.name || 'Restaurant Owner',
    operatorRole: currentUser?.role || 'owner',
  };
};

export const resolveEffectiveTableWaiter = (
  tableWaiter: string | undefined,
  activePOSStaff?: StaffMember | null,
  activeStaffUser?: StaffMember | null,
  fallbackUserName?: string
): string => {
  const cleaned = String(tableWaiter || '').trim();
  const operator = resolveActiveOperator(activePOSStaff, activeStaffUser);
  if (operator) {
    return isPlaceholderOperatorName(cleaned) ? operator.name : cleaned;
  }
  return cleaned || String(fallbackUserName || '').trim() || 'Restaurant Owner';
};
