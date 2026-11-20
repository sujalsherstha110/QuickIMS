import { StaffPermissions, StaffMember, PermissionAction, ModuleCrudPermission, StaffModulePermissions } from '../types';

export interface StaffPermissionModuleDef {
  key: keyof StaffModulePermissions;
  name: string;
  group: 'Core Operations' | 'Manage' | 'Kitchen & Stock' | 'Invoices & Parties' | 'Reports & Analysis' | 'Finance & Setup';
  description: string;
}

export const STAFF_PERMISSION_MODULES: StaffPermissionModuleDef[] = [
  // 1. Core Operations
  {
    key: 'posOrders',
    name: 'POS & Table Orders',
    group: 'Core Operations',
    description: 'Seat tables, punch KOT orders, modify items, apply discounts, void & cancel orders'
  },
  {
    key: 'kitchenBar',
    name: 'Kitchen (KDS) & Bar (BOT)',
    group: 'Core Operations',
    description: 'View active prep tickets, update cooking/ready status, bump items, manage stations'
  },

  // 2. Manage
  {
    key: 'menuCatalog',
    name: 'Menu & Dishes',
    group: 'Manage',
    description: 'View menu catalog, create food/drinks, update prices & recipes, delete dishes'
  },
  {
    key: 'tableFloor',
    name: 'Table & Floor Plan',
    group: 'Manage',
    description: 'View table layout, create floors/sections, reposition tables, delete dining furniture'
  },
  {
    key: 'staffShifts',
    name: 'Staff & Shift Permissions',
    group: 'Manage',
    description: 'View staff directory, create employee profiles, modify permissions & PINs, deactivate staff'
  },

  // 3. Kitchen & Stock
  {
    key: 'inventoryStock',
    name: 'Pantry Stock & Raw Items',
    group: 'Kitchen & Stock',
    description: 'View pantry balance, create raw stock items, adjust quantities, delete ingredients'
  },
  {
    key: 'foodControl',
    name: 'Food Control & Wastage',
    group: 'Kitchen & Stock',
    description: 'View spoilage history, record daily kitchen waste, update COGS variance, delete waste logs'
  },

  // 4. Invoices & Parties
  {
    key: 'invoicesBilling',
    name: 'Sales Invoices & Tax Bills',
    group: 'Invoices & Parties',
    description: 'View guest bills, settle cash/QR/card payments, apply discounts, void or cancel invoices'
  },
  {
    key: 'purchasesSuppliers',
    name: 'Purchases & Food Vendors',
    group: 'Invoices & Parties',
    description: 'View vendor bills, record purchase intake, edit supplier payables, delete purchase bills'
  },
  {
    key: 'customers',
    name: 'Customer CRM & Credit Accounts',
    group: 'Invoices & Parties',
    description: 'View customer directory, register guests, modify credit limits & balances, delete accounts'
  },

  // 5. Reports & Analysis
  {
    key: 'reportsAnalytics',
    name: 'Sales & Revenue Analytics',
    group: 'Reports & Analysis',
    description: 'View daily sales book, product breakdown, category revenue, export CSV/Excel reports'
  },
  {
    key: 'vatTaxReports',
    name: 'Tax & VAT (13%) Reports',
    group: 'Reports & Analysis',
    description: 'View IRD Annexure 4/5, taxable sales returns, verify tax compliance, export tax logs'
  },

  // 6. Finance & Setup
  {
    key: 'cashRegister',
    name: 'Cash Register & Shifts',
    group: 'Finance & Setup',
    description: 'View cash drawer balance, open/close shifts, record cash float / petty cash, reconcile drawer'
  },
  {
    key: 'settingsPrinters',
    name: 'Settings & Hardware Printers',
    group: 'Finance & Setup',
    description: 'View store profile, configure thermal KOT/BOT printers, adjust VAT rates, backup & reset'
  }
];

export const createBlankModuleCrud = (value = false): ModuleCrudPermission => ({
  read: value,
  write: value,
  update: value,
  delete: value
});

export const getDefaultStaffModulePermissions = (role: string): StaffModulePermissions => {
  const r = (role || '').toLowerCase();

  // Full Access for Owner / Manager / Admin / Supervisor
  if (r.includes('manager') || r.includes('admin') || r.includes('owner') || r.includes('supervisor')) {
    return {
      posOrders: { read: true, write: true, update: true, delete: true },
      kitchenBar: { read: true, write: true, update: true, delete: true },
      menuCatalog: { read: true, write: true, update: true, delete: true },
      tableFloor: { read: true, write: true, update: true, delete: true },
      staffShifts: { read: true, write: true, update: true, delete: true },
      inventoryStock: { read: true, write: true, update: true, delete: true },
      foodControl: { read: true, write: true, update: true, delete: true },
      invoicesBilling: { read: true, write: true, update: true, delete: true },
      purchasesSuppliers: { read: true, write: true, update: true, delete: true },
      customers: { read: true, write: true, update: true, delete: true },
      reportsAnalytics: { read: true, write: true, update: true, delete: true },
      vatTaxReports: { read: true, write: true, update: true, delete: true },
      cashRegister: { read: true, write: true, update: true, delete: true },
      settingsPrinters: { read: true, write: true, update: true, delete: true }
    };
  }

  // Cashier / Billing Specialist
  if (r.includes('cashier') || r.includes('billing') || r.includes('accountant')) {
    return {
      posOrders: { read: true, write: true, update: true, delete: true },
      kitchenBar: { read: true, write: false, update: false, delete: false },
      menuCatalog: { read: true, write: false, update: false, delete: false },
      tableFloor: { read: true, write: false, update: false, delete: false },
      staffShifts: { read: false, write: false, update: false, delete: false },
      inventoryStock: { read: true, write: false, update: false, delete: false },
      foodControl: { read: false, write: false, update: false, delete: false },
      invoicesBilling: { read: true, write: true, update: true, delete: true },
      purchasesSuppliers: { read: true, write: false, update: false, delete: false },
      customers: { read: true, write: true, update: true, delete: false },
      reportsAnalytics: { read: true, write: false, update: false, delete: false },
      vatTaxReports: { read: true, write: false, update: false, delete: false },
      cashRegister: { read: true, write: true, update: true, delete: false },
      settingsPrinters: { read: true, write: false, update: false, delete: false }
    };
  }

  // Head Chef / Kitchen Lead / Cooks
  if (r.includes('chef') || r.includes('cook') || r.includes('bakery') || r.includes('pastry') || r.includes('kitchen')) {
    const isLead = r.includes('head') || r.includes('executive') || r.includes('chef');
    return {
      posOrders: { read: true, write: false, update: false, delete: false },
      kitchenBar: { read: true, write: true, update: true, delete: isLead },
      menuCatalog: { read: true, write: isLead, update: isLead, delete: false },
      tableFloor: { read: true, write: false, update: false, delete: false },
      staffShifts: { read: isLead, write: false, update: false, delete: false },
      inventoryStock: { read: true, write: true, update: true, delete: isLead },
      foodControl: { read: true, write: true, update: true, delete: isLead },
      purchasesSuppliers: { read: true, write: isLead, update: isLead, delete: false },
      customers: { read: false, write: false, update: false, delete: false },
      invoicesBilling: { read: false, write: false, update: false, delete: false },
      reportsAnalytics: { read: false, write: false, update: false, delete: false },
      vatTaxReports: { read: false, write: false, update: false, delete: false },
      cashRegister: { read: false, write: false, update: false, delete: false },
      settingsPrinters: { read: true, write: false, update: false, delete: false }
    };
  }

  // Bartender / Barista / Sommelier
  if (r.includes('bar') || r.includes('beverage') || r.includes('sommelier') || r.includes('barista')) {
    return {
      posOrders: { read: true, write: true, update: true, delete: false },
      kitchenBar: { read: true, write: true, update: true, delete: false },
      menuCatalog: { read: true, write: false, update: false, delete: false },
      tableFloor: { read: true, write: false, update: false, delete: false },
      staffShifts: { read: false, write: false, update: false, delete: false },
      inventoryStock: { read: true, write: true, update: true, delete: false },
      foodControl: { read: true, write: true, update: false, delete: false },
      purchasesSuppliers: { read: true, write: false, update: false, delete: false },
      customers: { read: true, write: true, update: false, delete: false },
      invoicesBilling: { read: true, write: true, update: false, delete: false },
      reportsAnalytics: { read: false, write: false, update: false, delete: false },
      vatTaxReports: { read: false, write: false, update: false, delete: false },
      cashRegister: { read: true, write: true, update: false, delete: false },
      settingsPrinters: { read: true, write: false, update: false, delete: false }
    };
  }

  // Waiter / Server / Captain / Host
  if (r.includes('waiter') || r.includes('server') || r.includes('captain') || r.includes('host') || r.includes('runner') || r.includes('steward')) {
    const isCaptain = r.includes('captain');
    return {
      posOrders: { read: true, write: true, update: true, delete: isCaptain },
      kitchenBar: { read: true, write: false, update: false, delete: false },
      menuCatalog: { read: true, write: false, update: false, delete: false },
      tableFloor: { read: true, write: false, update: false, delete: false },
      staffShifts: { read: false, write: false, update: false, delete: false },
      inventoryStock: { read: false, write: false, update: false, delete: false },
      foodControl: { read: false, write: false, update: false, delete: false },
      purchasesSuppliers: { read: false, write: false, update: false, delete: false },
      customers: { read: true, write: true, update: false, delete: false },
      invoicesBilling: { read: false, write: false, update: false, delete: false },
      reportsAnalytics: { read: false, write: false, update: false, delete: false },
      vatTaxReports: { read: false, write: false, update: false, delete: false },
      cashRegister: { read: false, write: false, update: false, delete: false },
      settingsPrinters: { read: false, write: false, update: false, delete: false }
    };
  }

  // Storekeeper / Inventory Manager
  if (r.includes('store') || r.includes('inventory') || r.includes('warehouse')) {
    return {
      posOrders: { read: false, write: false, update: false, delete: false },
      kitchenBar: { read: false, write: false, update: false, delete: false },
      menuCatalog: { read: true, write: false, update: false, delete: false },
      tableFloor: { read: false, write: false, update: false, delete: false },
      staffShifts: { read: false, write: false, update: false, delete: false },
      inventoryStock: { read: true, write: true, update: true, delete: true },
      foodControl: { read: true, write: true, update: true, delete: false },
      purchasesSuppliers: { read: true, write: true, update: true, delete: false },
      customers: { read: false, write: false, update: false, delete: false },
      invoicesBilling: { read: false, write: false, update: false, delete: false },
      reportsAnalytics: { read: true, write: false, update: false, delete: false },
      vatTaxReports: { read: false, write: false, update: false, delete: false },
      cashRegister: { read: false, write: false, update: false, delete: false },
      settingsPrinters: { read: true, write: false, update: false, delete: false }
    };
  }

  // Default Standard Fallback (Read POS + Orders)
  return {
    posOrders: { read: true, write: true, update: true, delete: false },
    kitchenBar: { read: false, write: false, update: false, delete: false },
    menuCatalog: { read: true, write: false, update: false, delete: false },
    tableFloor: { read: true, write: false, update: false, delete: false },
    staffShifts: { read: false, write: false, update: false, delete: false },
    inventoryStock: { read: false, write: false, update: false, delete: false },
    foodControl: { read: false, write: false, update: false, delete: false },
    purchasesSuppliers: { read: false, write: false, update: false, delete: false },
    customers: { read: true, write: false, update: false, delete: false },
    invoicesBilling: { read: false, write: false, update: false, delete: false },
    reportsAnalytics: { read: false, write: false, update: false, delete: false },
    vatTaxReports: { read: false, write: false, update: false, delete: false },
    cashRegister: { read: false, write: false, update: false, delete: false },
    settingsPrinters: { read: false, write: false, update: false, delete: false }
  };
};

export const getRoleOperationalDefaults = (role: string): {
  maxDiscountPercent: number;
  canOpenCashDrawer: boolean;
  canReprintBills: boolean;
} => {
  const r = (role || '').toLowerCase();
  if (r.includes('manager') || r.includes('admin') || r.includes('owner') || r.includes('supervisor')) {
    return { maxDiscountPercent: 100, canOpenCashDrawer: true, canReprintBills: true };
  }
  if (r.includes('cashier') || r.includes('billing') || r.includes('accountant')) {
    return { maxDiscountPercent: 15, canOpenCashDrawer: true, canReprintBills: true };
  }
  if (r.includes('chef') || r.includes('cook') || r.includes('bakery') || r.includes('pastry') || r.includes('kitchen')) {
    return { maxDiscountPercent: 0, canOpenCashDrawer: false, canReprintBills: false };
  }
  if (r.includes('bar') || r.includes('beverage') || r.includes('sommelier') || r.includes('barista')) {
    return { maxDiscountPercent: 10, canOpenCashDrawer: true, canReprintBills: true };
  }
  if (r.includes('waiter') || r.includes('server') || r.includes('captain') || r.includes('host') || r.includes('runner') || r.includes('steward')) {
    return { maxDiscountPercent: 5, canOpenCashDrawer: false, canReprintBills: true };
  }
  if (r.includes('store') || r.includes('inventory') || r.includes('warehouse')) {
    return { maxDiscountPercent: 0, canOpenCashDrawer: false, canReprintBills: false };
  }
  return { maxDiscountPercent: 0, canOpenCashDrawer: false, canReprintBills: true };
};

/**
 * Synchronize legacy boolean flags with granular module CRUD permissions
 * without overwriting explicit operational controls (discount cap, cash drawer, reprint).
 */
export const syncStaffPermissions = (
  basePermissions: Partial<StaffPermissions>,
  modules: StaffModulePermissions
): StaffPermissions => {
  const canApplyDiscounts = Boolean(modules.posOrders?.update || modules.invoicesBilling?.update);
  const rawMaxDiscount =
    typeof basePermissions.maxDiscountPercent === 'number' && !Number.isNaN(basePermissions.maxDiscountPercent)
      ? Math.min(100, Math.max(0, basePermissions.maxDiscountPercent))
      : modules.invoicesBilling?.delete
        ? 100
        : canApplyDiscounts
          ? 15
          : 0;

  return {
    canPunchOrders: Boolean(modules.posOrders?.write || modules.posOrders?.read),
    canApplyDiscounts,
    maxDiscountPercent: rawMaxDiscount,
    canVoidItems: Boolean(modules.posOrders?.delete),
    canCancelBills: Boolean(modules.invoicesBilling?.delete),
    canReprintBills:
      typeof basePermissions.canReprintBills === 'boolean'
        ? basePermissions.canReprintBills
        : Boolean(modules.invoicesBilling?.read || modules.posOrders?.read),
    canOpenCashDrawer:
      typeof basePermissions.canOpenCashDrawer === 'boolean'
        ? basePermissions.canOpenCashDrawer
        : Boolean(modules.cashRegister?.write || modules.cashRegister?.update),
    canAccessKDS: Boolean(modules.kitchenBar?.read),
    canAccessBOT: Boolean(modules.kitchenBar?.read),
    canAccessInventory: Boolean(modules.inventoryStock?.read || modules.foodControl?.read),
    canViewReports: Boolean(modules.reportsAnalytics?.read || modules.vatTaxReports?.read || modules.invoicesBilling?.read),
    canManageStaff: Boolean(modules.staffShifts?.write || modules.staffShifts?.update || modules.staffShifts?.delete),
    modules
  };
};

/**
 * Check if a staff member has permission for a specific module action (Read, Write, Update, Delete)
 */
export const checkStaffModulePermission = (
  staff: StaffMember | null,
  moduleKey: keyof StaffModulePermissions,
  action: PermissionAction,
  isOwnerOrAdmin = false
): boolean => {
  // 1. Explicit owner override (when not impersonating/operating as staff)
  if (isOwnerOrAdmin && !staff) return true;

  // 2. If no staff is currently active and the user is operating as venue owner, grant full access
  if (!staff) return true;

  const permissions = staff.permissions;
  if (!permissions) return false;

  // 3. If granular modules are defined, evaluate precisely
  if (permissions.modules && permissions.modules[moduleKey]) {
    return Boolean(permissions.modules[moduleKey][action]);
  }

  // 4. Intelligent fallback based on legacy boolean flags if modules is undefined
  switch (moduleKey) {
    case 'posOrders':
      if (action === 'read' || action === 'write') return !!permissions.canPunchOrders;
      if (action === 'update') return !!permissions.canPunchOrders;
      if (action === 'delete') return !!permissions.canVoidItems;
      return false;

    case 'kitchenBar':
      if (action === 'read') return !!permissions.canAccessKDS || !!permissions.canAccessBOT;
      if (action === 'write' || action === 'update') return !!permissions.canAccessKDS || !!permissions.canAccessBOT;
      if (action === 'delete') return !!permissions.canAccessKDS && !!permissions.canManageStaff;
      return false;

    case 'menuCatalog':
      if (action === 'read') return true;
      if (action === 'write' || action === 'update' || action === 'delete') return !!permissions.canManageStaff;
      return false;

    case 'tableFloor':
      if (action === 'read') return true;
      if (action === 'write' || action === 'update' || action === 'delete') return !!permissions.canManageStaff;
      return false;

    case 'inventoryStock':
    case 'foodControl':
      if (action === 'read') return !!permissions.canAccessInventory;
      if (action === 'write' || action === 'update') return !!permissions.canAccessInventory;
      if (action === 'delete') return !!permissions.canAccessInventory && !!permissions.canManageStaff;
      return false;

    case 'invoicesBilling':
      if (action === 'read') return !!permissions.canViewReports || !!permissions.canPunchOrders;
      if (action === 'write') return !!permissions.canPunchOrders;
      if (action === 'update') return !!permissions.canApplyDiscounts || !!permissions.canCancelBills;
      if (action === 'delete') return !!permissions.canCancelBills;
      return false;

    case 'purchasesSuppliers':
      if (action === 'read') return !!permissions.canAccessInventory || !!permissions.canViewReports;
      if (action === 'write' || action === 'update') return !!permissions.canAccessInventory;
      if (action === 'delete') return !!permissions.canManageStaff;
      return false;

    case 'customers':
      if (action === 'read' || action === 'write') return true;
      if (action === 'update') return !!permissions.canPunchOrders || !!permissions.canViewReports;
      if (action === 'delete') return !!permissions.canManageStaff;
      return false;

    case 'reportsAnalytics':
    case 'vatTaxReports':
      if (action === 'read') return !!permissions.canViewReports;
      return !!permissions.canManageStaff;

    case 'staffShifts':
      if (action === 'read') return !!permissions.canManageStaff;
      return !!permissions.canManageStaff;

    case 'cashRegister':
      if (action === 'read') return !!permissions.canOpenCashDrawer || !!permissions.canViewReports;
      if (action === 'write' || action === 'update') return !!permissions.canOpenCashDrawer;
      if (action === 'delete') return !!permissions.canManageStaff;
      return false;

    case 'settingsPrinters':
      if (action === 'read') return true;
      return !!permissions.canManageStaff;

    default:
      return false;
  }
};

/**
 * Summarize a staff member's total permissions for directory cards and badge indicators
 */
export const getPermissionsSummary = (permissions?: StaffPermissions) => {
  if (!permissions) {
    return {
      totalRead: 0,
      totalWrite: 0,
      totalUpdate: 0,
      totalDelete: 0,
      totalModules: STAFF_PERMISSION_MODULES.length,
      isFullAccess: false
    };
  }

  const modules = permissions.modules || getDefaultStaffModulePermissions('waiter');
  let read = 0;
  let write = 0;
  let update = 0;
  let del = 0;

  STAFF_PERMISSION_MODULES.forEach(mod => {
    const m = modules[mod.key];
    if (m?.read) read++;
    if (m?.write) write++;
    if (m?.update) update++;
    if (m?.delete) del++;
  });

  const total = STAFF_PERMISSION_MODULES.length;
  const isFullAccess = read === total && write === total && update === total && del === total;

  return {
    totalRead: read,
    totalWrite: write,
    totalUpdate: update,
    totalDelete: del,
    totalModules: total,
    isFullAccess
  };
};

const ALL_NAV_TABS: string[] = [
  'dashboard',
  'pos',
  'tables',
  'kds',
  'bot',
  'products',
  'staff',
  'recipes',
  'inventory',
  'waste',
  'invoice-reports',
  'purchases',
  'customers',
  'suppliers',
  'reports',
  'vat-reports',
  'accounting',
  'printers',
  'settings'
];

/**
 * Determine whether a navigation tab is accessible for the active staff operator.
 * Returns true for unrestricted Owner Mode (staff === null).
 */
export const isTabAllowedForStaffPermissions = (
  tabId: string,
  staff: StaffMember | null
): boolean => {
  if (!staff) return true;

  const normalizedTab = tabId === 'floor-config' ? 'tables' : tabId;
  const canDo = (moduleKey: keyof StaffModulePermissions, action: PermissionAction) =>
    checkStaffModulePermission(staff, moduleKey, action, false);

  switch (normalizedTab) {
    case 'dashboard':
      return (
        canDo('reportsAnalytics', 'read') ||
        canDo('posOrders', 'read') ||
        canDo('kitchenBar', 'read') ||
        canDo('invoicesBilling', 'read')
      );
    case 'pos':
      return canDo('posOrders', 'read') || canDo('posOrders', 'write');
    case 'tables':
      return canDo('tableFloor', 'read');
    case 'kds':
    case 'bot':
      return canDo('kitchenBar', 'read');
    case 'products':
      return canDo('menuCatalog', 'read');
    case 'recipes':
    case 'inventory':
      return canDo('inventoryStock', 'read');
    case 'waste':
    case 'food-cost':
      return canDo('foodControl', 'read');
    case 'invoice-reports':
    case 'bill-reports':
      return canDo('invoicesBilling', 'read');
    case 'purchases':
    case 'suppliers':
      return canDo('purchasesSuppliers', 'read');
    case 'customers':
      return canDo('customers', 'read');
    case 'reports':
      return canDo('reportsAnalytics', 'read');
    case 'vat-reports':
      return canDo('vatTaxReports', 'read');
    case 'accounting':
      return canDo('cashRegister', 'read');
    case 'staff':
      return canDo('staffShifts', 'read');
    case 'printers':
    case 'settings':
      return canDo('settingsPrinters', 'read');
    default:
      return false;
  }
};

/**
 * Resolve the best allowed landing tab for an active staff operator (or 'dashboard' for Owner Mode).
 */
export const getDefaultTabForStaff = (staff: StaffMember | null): string => {
  if (!staff) return 'dashboard';

  const role = String(staff.role || '').toLowerCase();
  let preferred: string[];
  if (role.includes('chef') || role.includes('cook') || role.includes('kitchen')) {
    preferred = ['kds', 'inventory', 'recipes', 'waste', 'products', 'pos', 'dashboard'];
  } else if (role.includes('bar') || role.includes('bartender') || role.includes('barista')) {
    preferred = ['bot', 'pos', 'kds', 'inventory', 'dashboard'];
  } else if (role.includes('waiter') || role.includes('server') || role.includes('captain') || role.includes('host')) {
    preferred = ['pos', 'tables', 'customers', 'kds', 'bot', 'dashboard'];
  } else if (role.includes('cashier') || role.includes('billing') || role.includes('accountant')) {
    preferred = ['pos', 'invoice-reports', 'accounting', 'customers', 'reports', 'vat-reports', 'dashboard'];
  } else if (role.includes('store') || role.includes('inventory') || role.includes('warehouse')) {
    preferred = ['inventory', 'purchases', 'suppliers', 'waste', 'recipes', 'products', 'dashboard'];
  } else {
    preferred = ['dashboard', 'pos', 'tables', 'kds', 'bot'];
  }

  const candidates = [...preferred, ...ALL_NAV_TABS.filter(t => !preferred.includes(t))];
  const firstAllowed = candidates.find(tab => isTabAllowedForStaffPermissions(tab, staff));
  return firstAllowed || 'no-access';
};

