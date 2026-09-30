import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, Filter, Search, Clock, User, Tag, 
  AlertTriangle, DollarSign, FileText, CheckCircle2, RotateCcw,
  Sparkles, Coffee, LogIn, LogOut, ArrowRight, ShieldCheck
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
      const matchAction = selectedActionType === 'all' || 
        (selectedActionType === 'sensitive' ? ['item_void', 'bill_cancelled', 'discount_applied', 'manual_drawer_open', 'pin_override'].includes(log.actionType) :
         selectedActionType === 'attendance' ? ['clock_in', 'clock_out', 'break_start', 'break_end'].includes(log.actionType) :
         log.actionType === selectedActionType);

      const matchStaff = selectedStaffId === 'all' || log.staffId === selectedStaffId;

      const matchSearch = 
        log.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.reason && log.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.targetEntityName && log.targetEntityName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.targetEntityId && log.targetEntityId.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchAction && matchStaff && matchSearch;
    });
  }, [staffAuditLogs, selectedActionType, selectedStaffId, searchQuery]);

  // Statistics
  const voidsCount = useMemo(() => staffAuditLogs.filter(l => l.actionType === 'item_void').length, [staffAuditLogs]);
  const discountsCount = useMemo(() => staffAuditLogs.filter(l => l.actionType === 'discount_applied').length, [staffAuditLogs]);
  const drawerPopsCount = useMemo(() => staffAuditLogs.filter(l => l.actionType === 'manual_drawer_open').length, [staffAuditLogs]);
  const overridesCount = useMemo(() => staffAuditLogs.filter(l => l.actionType === 'pin_override').length, [staffAuditLogs]);

  const getActionBadge = (action: StaffAuditLog['actionType']) => {
    switch (action) {
      case 'item_void':
        return {
          label: 'Item Voided',
          bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        };
      case 'bill_cancelled':
        return {
          label: 'Bill Cancelled',
          bg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
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
          label: 'PIN Switch',
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
      default:
        return {
          label: action.replace(/_/g, ' '),
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
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Drawer Pops</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{drawerPopsCount}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Manual cash drawer triggers</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PIN Switches</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{overridesCount}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Operator switch on terminal</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedActionType('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedActionType === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All Events ({staffAuditLogs.length})
            </button>
            <button
              onClick={() => setSelectedActionType('sensitive')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedActionType === 'sensitive'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Sensitive Only (Voids / Discounts)
            </button>
            <button
              onClick={() => setSelectedActionType('attendance')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedActionType === 'attendance'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Attendance Punches
            </button>
            <button
              onClick={() => setSelectedActionType('item_void')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
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
              {staffMembers.map(staff => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} ({staff.employeeCode})
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
                  const dateObj = new Date(log.timestamp);

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
                            {log.staffName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{log.staffName}</span>
                            <span className="text-[10px] text-slate-400 capitalize">{log.staffRole.replace(/_/g, ' ')}</span>
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
