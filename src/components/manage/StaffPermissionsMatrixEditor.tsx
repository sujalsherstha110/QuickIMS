import React from 'react';
import { 
  Shield, Check, CheckSquare, XSquare, RotateCcw, 
  Sparkles, ChefHat, ShoppingCart, Wine, DollarSign,
  AlertTriangle, KeyRound, Info, Layers
} from 'lucide-react';
import { StaffPermissions, StaffModulePermissions, PermissionAction, ModuleCrudPermission } from '../../types';
import { 
  STAFF_PERMISSION_MODULES, 
  StaffPermissionModuleDef, 
  getDefaultStaffModulePermissions,
  getRoleOperationalDefaults,
  syncStaffPermissions,
  createBlankModuleCrud
} from '../../utils/staffPermissionUtils';

interface StaffPermissionsMatrixEditorProps {
  permissions: StaffPermissions;
  currentRole: string;
  onChange: (updatedPermissions: StaffPermissions) => void;
  readOnly?: boolean;
}

export const StaffPermissionsMatrixEditor: React.FC<StaffPermissionsMatrixEditorProps> = ({
  permissions,
  currentRole,
  onChange,
  readOnly = false
}) => {
  const currentModules: StaffModulePermissions = permissions.modules || getDefaultStaffModulePermissions(currentRole);

  const handleToggleAction = (moduleKey: keyof StaffModulePermissions, action: PermissionAction) => {
    if (readOnly) return;
    const existingMod = currentModules[moduleKey] || createBlankModuleCrud();
    const updatedMod: ModuleCrudPermission = {
      ...existingMod,
      [action]: !existingMod[action]
    };

    // If granting write/update/delete, auto-grant read for convenience
    if (action !== 'read' && updatedMod[action] && !updatedMod.read) {
      updatedMod.read = true;
    }
    // If revoking read, auto-revoke write/update/delete
    if (action === 'read' && !updatedMod.read) {
      updatedMod.write = false;
      updatedMod.update = false;
      updatedMod.delete = false;
    }

    const updatedModules: StaffModulePermissions = {
      ...currentModules,
      [moduleKey]: updatedMod
    };

    const nextBase: Partial<StaffPermissions> = {
      ...permissions,
      ...(moduleKey === 'cashRegister'
        ? { canOpenCashDrawer: Boolean(updatedMod.write || updatedMod.update) }
        : {})
    };

    onChange(syncStaffPermissions(nextBase, updatedModules));
  };

  const handleRowPreset = (moduleKey: keyof StaffModulePermissions, preset: 'full' | 'view_only' | 'read_write' | 'none') => {
    if (readOnly) return;
    let newMod: ModuleCrudPermission;
    switch (preset) {
      case 'full':
        newMod = { read: true, write: true, update: true, delete: true };
        break;
      case 'read_write':
        newMod = { read: true, write: true, update: true, delete: false };
        break;
      case 'view_only':
        newMod = { read: true, write: false, update: false, delete: false };
        break;
      case 'none':
        newMod = { read: false, write: false, update: false, delete: false };
        break;
    }

    const updatedModules: StaffModulePermissions = {
      ...currentModules,
      [moduleKey]: newMod
    };

    const nextBase: Partial<StaffPermissions> = {
      ...permissions,
      ...(moduleKey === 'cashRegister'
        ? { canOpenCashDrawer: Boolean(newMod.write || newMod.update) }
        : {})
    };

    onChange(syncStaffPermissions(nextBase, updatedModules));
  };

  const handleApplyRolePreset = (roleName: string) => {
    if (readOnly) return;
    const presetModules = getDefaultStaffModulePermissions(roleName);
    const opDefaults = getRoleOperationalDefaults(roleName);
    onChange(syncStaffPermissions(opDefaults, presetModules));
  };

  const handleToggleAllColumn = (action: PermissionAction) => {
    if (readOnly) return;
    // Check if all are currently active
    const allActive = STAFF_PERMISSION_MODULES.every(m => currentModules[m.key]?.[action]);
    const targetState = !allActive;

    const nextModules: StaffModulePermissions = { ...currentModules };
    STAFF_PERMISSION_MODULES.forEach(m => {
      const cur = nextModules[m.key] || createBlankModuleCrud();
      nextModules[m.key] = {
        ...cur,
        [action]: targetState,
        // If enabling write/update/delete, also ensure read is true
        ...(targetState && action !== 'read' ? { read: true } : {}),
        // If disabling read, disable everything
        ...(!targetState && action === 'read' ? { write: false, update: false, delete: false } : {})
      };
    });

    const nextBase: Partial<StaffPermissions> = {
      ...permissions,
      ...(action === 'write' || action === 'update' || action === 'read'
        ? { canOpenCashDrawer: Boolean(nextModules.cashRegister?.write || nextModules.cashRegister?.update) }
        : {})
    };

    onChange(syncStaffPermissions(nextBase, nextModules));
  };

  const handleGrantFullAccess = () => {
    if (readOnly) return;
    const nextModules: StaffModulePermissions = { ...currentModules };
    STAFF_PERMISSION_MODULES.forEach(m => {
      nextModules[m.key] = { read: true, write: true, update: true, delete: true };
    });
    onChange(syncStaffPermissions({
      maxDiscountPercent: 100,
      canOpenCashDrawer: true,
      canReprintBills: true
    }, nextModules));
  };

  const handleClearAllAccess = () => {
    if (readOnly) return;
    const nextModules: StaffModulePermissions = { ...currentModules };
    STAFF_PERMISSION_MODULES.forEach(m => {
      nextModules[m.key] = { read: false, write: false, update: false, delete: false };
    });
    onChange(syncStaffPermissions({
      maxDiscountPercent: 0,
      canOpenCashDrawer: false,
      canReprintBills: false
    }, nextModules));
  };

  // Group modules by category
  const groups: StaffPermissionModuleDef['group'][] = [
    'Core Operations',
    'Manage',
    'Kitchen & Stock',
    'Invoices & Parties',
    'Reports & Analysis',
    'Finance & Setup'
  ];

  return (
    <div className="space-y-5 text-slate-800 dark:text-slate-100">
      {/* Header & Role Template Quick Presets */}
      {!readOnly && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/80 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Role Permission Presets
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                (Click to auto-populate CRUD matrix)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleGrantFullAccess}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                Full Access (All CRUD)
              </button>
              <button
                type="button"
                onClick={handleClearAllAccess}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Manager / Supervisor', role: 'manager' },
              { label: 'Cashier / Billing', role: 'cashier' },
              { label: 'Head Chef / Kitchen', role: 'chef' },
              { label: 'Bartender / Barista', role: 'bar' },
              { label: 'Waiter / Server', role: 'waiter' },
              { label: 'Storekeeper / Stock', role: 'store' }
            ].map(preset => (
              <button
                key={preset.role}
                type="button"
                onClick={() => handleApplyRolePreset(preset.role)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 shadow-xs transition-all cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Column Actions Bar */}
      {!readOnly && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 flex-wrap gap-2">
          <span>Batch Column Toggles:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleAllColumn('read')}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer text-[11px]"
            >
              Toggle All Read
            </button>
            <button
              type="button"
              onClick={() => handleToggleAllColumn('write')}
              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer text-[11px]"
            >
              Toggle All Write
            </button>
            <button
              type="button"
              onClick={() => handleToggleAllColumn('update')}
              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors cursor-pointer text-[11px]"
            >
              Toggle All Update
            </button>
            <button
              type="button"
              onClick={() => handleToggleAllColumn('delete')}
              className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors cursor-pointer text-[11px]"
            >
              Toggle All Delete
            </button>
          </div>
        </div>
      )}

      {/* Main CRUD Matrix Table */}
      <div className="space-y-4">
        {groups.map(groupName => {
          const groupModules = STAFF_PERMISSION_MODULES.filter(m => m.group === groupName);
          if (groupModules.length === 0) return null;

          return (
            <div key={groupName} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
              {/* Group Header */}
              <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {groupName}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {groupModules.length} Modules
                </span>
              </div>

              {/* Module Rows */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {groupModules.map(mod => {
                  const perms = currentModules[mod.key] || createBlankModuleCrud();

                  return (
                    <div 
                      key={mod.key} 
                      className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Module info */}
                      <div className="md:w-5/12">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {mod.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {mod.description}
                        </p>
                      </div>

                      {/* 4 CRUD Toggle Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* READ BADGE */}
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleToggleAction(mod.key, 'read')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            perms.read
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                          title="Can view and query this module and its records"
                        >
                          <span className={`w-2 h-2 rounded-full ${perms.read ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                          <span>READ</span>
                        </button>

                        {/* WRITE / CREATE BADGE */}
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleToggleAction(mod.key, 'write')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            perms.write
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                          title="Can create and add new entries"
                        >
                          <span className={`w-2 h-2 rounded-full ${perms.write ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                          <span>WRITE</span>
                        </button>

                        {/* UPDATE / EDIT BADGE */}
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleToggleAction(mod.key, 'update')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            perms.update
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                          title="Can modify and edit existing records"
                        >
                          <span className={`w-2 h-2 rounded-full ${perms.update ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                          <span>UPDATE</span>
                        </button>

                        {/* DELETE / VOID BADGE */}
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleToggleAction(mod.key, 'delete')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            perms.delete
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                          title="Can delete, void or cancel records"
                        >
                          <span className={`w-2 h-2 rounded-full ${perms.delete ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                          <span>DELETE</span>
                        </button>
                      </div>

                      {/* Quick row preset shortcuts */}
                      {!readOnly && (
                        <div className="flex items-center gap-1 shrink-0 pt-1 md:pt-0">
                          <button
                            type="button"
                            onClick={() => handleRowPreset(mod.key, 'full')}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Grant Full CRUD on this module"
                          >
                            Full
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowPreset(mod.key, 'read_write')}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Read + Write + Update"
                          >
                            R+W+U
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowPreset(mod.key, 'view_only')}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Read Only"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowPreset(mod.key, 'none')}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 hover:text-rose-700 text-slate-400 transition-colors cursor-pointer"
                            title="Revoke all on this module"
                          >
                            None
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Operational Limits & Overrides */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
          Operational Security & Cash Controls
        </span>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Max discount percent */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Max Allowable Discount Without Override (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                disabled={readOnly}
                value={permissions.maxDiscountPercent ?? 0}
                onChange={e => onChange({
                  ...permissions,
                  maxDiscountPercent: Math.min(100, Math.max(0, Number(e.target.value)))
                })}
                className="w-24 px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
              <span className="text-xs text-slate-400 font-mono">%</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Discounts above this require Manager PIN authorization.</p>
          </div>

          {/* Cash drawer */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="canOpenCashDrawerCheck"
              disabled={readOnly}
              checked={permissions.canOpenCashDrawer}
              onChange={e => onChange({
                ...permissions,
                canOpenCashDrawer: e.target.checked
              })}
              className="mt-1 rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="canOpenCashDrawerCheck" className="text-xs cursor-pointer">
              <span className="font-bold text-slate-900 dark:text-white block">Open Cash Drawer</span>
              <span className="text-[11px] text-slate-500">Allow manual drawer pop on POS without bill settlement (logged in audit trail).</span>
            </label>
          </div>

          {/* Reprint bills */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="canReprintBillsCheck"
              disabled={readOnly}
              checked={permissions.canReprintBills}
              onChange={e => onChange({
                ...permissions,
                canReprintBills: e.target.checked
              })}
              className="mt-1 rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="canReprintBillsCheck" className="text-xs cursor-pointer">
              <span className="font-bold text-slate-900 dark:text-white block">Reprint Guest Receipts</span>
              <span className="text-[11px] text-slate-500">Allow printing duplicate checks and past settlement folios.</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
