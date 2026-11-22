import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, Search, Tag, 
  FileText, ShieldCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StaffAuditLog } from '../../types';

export const StaffAuditTrailView: React.FC = () => {
  const { staffAuditLogs, staffMembers } = useApp();
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = useMemo(() => {
    return staffAuditLogs.filter(log => {
      const matchAction =
        selectedActionType === 'all' ||
        (selectedActionType === 'sensitive'
          ? ['item_void', 'bill_cancelled', 'table_dissolved', 'discount_applied', 'manual_drawer_open', 'pin_override'].includes(log.actionType)
          : selectedActionType === 'orders_bills'
          ? ['order_fired', 'bill_settled', 'discount_applied', 'bill_cancelled'].includes(log.actionType)
          : selectedActionType === 'table_ops'
          ? ['table_transfer', 'table_dissolved', 'table_assigned'].includes(log.actionType)
          : selectedActionType === 'attendance'
          ? ['clock_in', 'clock_out', 'break_start', 'break_end'].includes(log.actionType)
          : log.actionType === selectedActionType);

      const matchStaff = selectedStaffId === 'all' || log.staffId === selectedStaffId;

      const q = String(searchQuery || '').toLowerCase().trim();
      const matchSearch =
        !q ||
        String(log.staffName || '').toLowerCase().includes(q) ||
        String(log.staffRole || '').toLowerCase().includes(q) ||
        String(log.actionType || '').toLowerCase().includes(q) ||
        String(log.details || '').toLowerCase().includes(q) ||
        (log.reason && String(log.reason).toLowerCase().includes(q)) ||
        (log.targetEntityName && String(log.targetEntityName).toLowerCase().includes(q)) ||
        (log.targetEntityId && String(log.targetEntityId).toLowerCase().includes(q));

      return matchAction && matchStaff && matchSearch;
    });
  }, [staffAuditLogs, selectedActionType, selectedStaffId, searchQuery]);

  // Build complete staff filter list (active roster + any Owner / Manager Override / deleted staff present in logs)
  const operatorFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    staffMembers.forEach(s => {
      if (s?.id) {
        map.set(s.id, `${s.name}${s.employeeCode ? ` (${s.employeeCode})` : ''}`);
      }
    });
    staffAuditLogs.forEach(l => {
      if (l?.staffId && !map.has(l.staffId)) {
        map.set(l.staffId, l.staffName || l.staffId);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [staffMembers, staffAuditLogs]);

  // Statistics
  const voidsCount = useMemo(
    () => staffAuditLogs.filter(l => l.actionType === 'item_void').length,
    [staffAuditLogs]
  );
  const discountsCount = useMemo(
    () => staffAuditLogs.filter(l => l.actionType === 'discount_applied').length,
    [staffAuditLogs]
  );
  const tableAndBillOpsCount = useMemo(
    () =>
      staffAuditLogs.filter(l =>
        ['bill_cancelled', 'table_dissolved', 'table_transfer', 'item_modified'].includes(l.actionType)
      ).length,
    [staffAuditLogs]
  );
  const overridesCount = useMemo(
    () => staffAuditLogs.filter(l => l.actionType === 'pin_override').length,
    [staffAuditLogs]
  );

  const getActionBadge = (action?: StaffAuditLog['actionType']) => {
    switch (action) {
      case 'item_void':
        return {
          label: 'Item Voided',
          bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        };
      case 'item_modified':
        return {
          label: 'Order Modified',
          bg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
        };
      case 'order_fired':
        return {
          label: 'Order Fired',
          bg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
        };
      case 'bill_settled':
        return {
          label: 'Bill Settled',
          bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
        };
      case 'bill_cancelled':
        return {
          label: 'Bill Cancelled',
          bg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
        };
      case 'table_dissolved':
        return {
          label: 'Table Dissolved',
          bg: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
        };
      case 'table_transfer':
        return {
          label: 'Table Moved',
          bg: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
        };
      case 'table_assigned':
        return {
          label: 'Table Seated',
          bg: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
        };
      case 'discount_applied':
        return {
          label: 'Discount Given',
          bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
        };
      case 'manual_drawer_open':
        return {
          label: 'Drawer Opened',
          bg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
        };
      case 'pin_override':
        return {
          label: 'PIN Auth',
          bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
        };
      case 'clock_in':
        return {
          label: 'Clock In',
          bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
        };
      case 'clock_out':
        return {
          label: 'Clock Out',
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        };
      case 'break_start':
      case 'break_end':
        return {
          label: action === 'break_start' ? 'Break Start' : 'Break End',
          bg: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
        };
      case 'staff_created':
        return {
          label: 'Staff Added',
          bg: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
        };
      case 'staff_updated':
        return {
          label: 'Staff Updated',
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        };
      default:
        return {
          label: String(action || 'activity').replace(/_/g, ' '),
          bg: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Item Voids</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{voidsCount}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Kitchen/Bar cancellations</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Discounts Applied</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{discountsCount}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Authorised price adjustments</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Table &amp; Bill Changes</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{tableAndBillOpsCount}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Moves, dissolves, restores &amp; voids</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PIN Authorizations</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{overridesCount}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Terminal PIN overrides &amp; prints</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedActionType('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedActionType === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All Events ({staffAuditLogs.length})
            </button>
            <button
              onClick={() => setSelectedActionType('sensitive')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedActionType === 'sensitive'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Sensitive (Voids / Discounts / Dissolves)
            </button>
            <button
              onClick={() => setSelectedActionType('orders_bills')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedActionType === 'orders_bills'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Orders &amp; Bills
            </button>
            <button
              onClick={() => setSelectedActionType('table_ops')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedActionType === 'table_ops'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Table Moves
            </button>
            <button
              onClick={() => setSelectedActionType('attendance')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedActionType === 'attendance'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Attendance Punches
            </button>
            <button
              onClick={() => setSelectedActionType('item_void')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedActionType === 'item_void'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Item Voids
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter by Staff */}
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Staff Members</option>
              {operatorFilterOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search audit trail..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto mt-5">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Time & Date</th>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Details & Notes</th>
                <th className="py-3 px-4">Staff Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No activity logs match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const badge = getActionBadge(log.actionType);
                  const dateObj = new Date(log.timestamp || Date.now());
                  const safeStaffName = String(log.staffName || 'Staff');
                  const safeStaffRole = String(log.staffRole || 'staff');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[10px]">
                            {safeStaffName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{safeStaffName}</span>
                            <span className="text-[10px] text-slate-400 capitalize">{safeStaffRole.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                          {log.targetEntityName || 'General POS'}
                        </span>
                        {log.targetEntityId && (
                          <span className="text-[10px] font-mono text-slate-400 block">{log.targetEntityId}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-sm text-slate-700 dark:text-slate-300">
                        {log.details}
                      </td>

                      <td className="py-3.5 px-4">
                        {log.reason ? (
                          <span className="italic text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-md text-[11px] block">
                            &ldquo;{log.reason}&rdquo;
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
