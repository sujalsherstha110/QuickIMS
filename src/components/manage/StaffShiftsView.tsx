import React, { useState } from 'react';
import { 
  Clock, Plus, Edit2, Trash2, Users, Calendar, 
  CheckCircle2, X, ChevronRight, Sparkles 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StaffShiftDefinition, StaffMember } from '../../types';

export const StaffShiftsView: React.FC = () => {
  const { staffShifts, addStaffShift, updateStaffShift, deleteStaffShift, staffMembers, updateStaffMember } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<StaffShiftDefinition | null>(null);
  const [assignModalShift, setAssignModalShift] = useState<StaffShiftDefinition | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    startTime: string;
    endTime: string;
    color: string;
    daysActive: string[];
    notes: string;
  }>({
    name: '',
    startTime: '08:00',
    endTime: '16:00',
    color: '#0284c7',
    daysActive: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    notes: ''
  });

  const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleOpenAdd = () => {
    setEditingShift(null);
    setFormData({
      name: '',
      startTime: '08:00',
      endTime: '16:00',
      color: '#0284c7',
      daysActive: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (shift: StaffShiftDefinition) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      color: shift.color,
      daysActive: shift.daysActive || allDays,
      notes: shift.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingShift) {
      await updateStaffShift(editingShift.id, formData);
    } else {
      await addStaffShift(formData);
    }
    setIsModalOpen(false);
  };

  const toggleDay = (day: string) => {
    setFormData(prev => {
      const exists = prev.daysActive.includes(day);
      if (exists) {
        return { ...prev, daysActive: prev.daysActive.filter(d => d !== day) };
      } else {
        return { ...prev, daysActive: [...prev.daysActive, day] };
      }
    });
  };

  const handleToggleStaffShiftAssignment = async (staffId: string, shiftId: string) => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) return;
    const isCurrentlyAssigned = staff.shiftId === shiftId || (assignModalShift && staff.shift === assignModalShift.name);
    if (isCurrentlyAssigned) {
      await updateStaffMember(staffId, {
        shiftId: undefined
      });
    } else {
      const targetShift = staffShifts.find(s => s.id === shiftId);
      await updateStaffMember(staffId, {
        shiftId,
        shift: targetShift ? targetShift.name : staff.shift,
        shiftStartTime: targetShift ? targetShift.startTime : staff.shiftStartTime,
        shiftEndTime: targetShift ? targetShift.endTime : staff.shiftEndTime,
        shiftDays: targetShift ? targetShift.daysActive : staff.shiftDays
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Shift Timings & Duty Roster</h2>
          <p className="text-xs text-slate-500">Configure floor and kitchen shift timings and assign staff teams</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add New Shift
        </button>
      </div>

      {/* Shift Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {staffShifts.map(shift => {
          const assignedStaff = staffMembers.filter(s => s.shiftId === shift.id || s.shift === shift.name);

          return (
            <div 
              key={shift.id} 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden"
            >
              <div 
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: shift.color }}
              />

              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{shift.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 mt-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>{shift.startTime} – {shift.endTime}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(shift)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {staffShifts.length > 1 && (
                      <button
                        onClick={() => deleteStaffShift(shift.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {shift.notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                    {shift.notes}
                  </p>
                )}

                {/* Days Active Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {allDays.map(d => {
                    const active = (shift.daysActive || allDays).includes(d);
                    return (
                      <span
                        key={d}
                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-md ${
                          active
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                            : 'text-slate-300 dark:text-slate-600'
                        }`}
                      >
                        {d}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Assigned Staff Preview */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-500 font-medium">Assigned Team</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{assignedStaff.length} Members</span>
                </div>

                <div className="flex items-center -space-x-2 overflow-hidden mb-3">
                  {assignedStaff.slice(0, 5).map(s => (
                    <div
                      key={s.id}
                      title={`${s.name} (${s.role})`}
                      className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: s.avatarColor || '#2563eb' }}
                    >
                      {s.name.slice(0, 1)}
                    </div>
                  ))}
                  {assignedStaff.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      +{assignedStaff.length - 5}
                    </div>
                  )}
                  {assignedStaff.length === 0 && (
                    <span className="text-[11px] text-slate-400 italic">No staff assigned</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setAssignModalShift(shift)}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  Manage Roster ({assignedStaff.length})
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Staff Roster Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Weekly Roster Matrix</h3>
            <p className="text-xs text-slate-500">Live operational assignment across floor and kitchen</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
            {staffMembers.length} Staff on Roster
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Assigned Shift</th>
                <th className="py-3 px-4">Hours / Timing</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {staffMembers.map(staff => {
                const matchedShift = staffShifts.find(sh => sh.id === staff.shiftId || sh.id.includes(staff.shift));

                return (
                  <tr key={staff.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs"
                          style={{ backgroundColor: staff.avatarColor || '#2563eb' }}
                        >
                          {staff.name.slice(0, 1)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">{staff.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{staff.employeeCode}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 capitalize">
                      {staff.role.replace(/_/g, ' ')}
                    </td>

                    <td className="py-3.5 px-4">
                      {matchedShift ? (
                        <span 
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-white inline-block shadow-xs"
                          style={{ backgroundColor: matchedShift.color }}
                        >
                          {matchedShift.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No shift set</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {matchedShift ? `${matchedShift.startTime} – ${matchedShift.endTime}` : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        staff.status === 'active' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : staff.status === 'on_break'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {staff.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <select
                        value={staff.shiftId || (matchedShift ? matchedShift.id : '')}
                        onChange={e => updateStaffMember(staff.id, { shiftId: e.target.value })}
                        className="px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {staffShifts.map(sh => (
                          <option key={sh.id} value={sh.id}>
                            {sh.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Shift Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingShift ? 'Edit Shift Schedule' : 'Create New Shift'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Shift Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Breakfast Rush"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Shift Badge Color
                </label>
                <div className="flex items-center gap-2">
                  {['#0284c7', '#d97706', '#7c3aed', '#059669', '#ea580c', '#e11d48', '#2563eb'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        formData.color === color ? 'scale-125 ring-2 ring-blue-500 ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Active Days
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allDays.map(d => {
                    const selected = formData.daysActive.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                          selected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Operational Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Station checklist, kitchen opening prep..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {editingShift ? 'Save Changes' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Staff in Shift Modal */}
      {assignModalShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Assign Staff to &ldquo;{assignModalShift.name}&rdquo;
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {assignModalShift.startTime} – {assignModalShift.endTime}
                </p>
              </div>
              <button 
                onClick={() => setAssignModalShift(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {staffMembers.map(staff => {
                const isAssigned = staff.shiftId === assignModalShift.id || staff.shift === assignModalShift.name;

                return (
                  <div key={staff.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-sm"
                        style={{ backgroundColor: staff.avatarColor || '#2563eb' }}
                      >
                        {staff.name.slice(0, 1)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-xs block">{staff.name}</span>
                        <span className="text-[10px] text-slate-400 capitalize">
                          {staff.employeeCode} • {staff.role.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStaffShiftAssignment(staff.id, assignModalShift.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        isAssigned
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {isAssigned ? 'Assigned' : 'Assign'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                type="button"
                onClick={() => setAssignModalShift(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
