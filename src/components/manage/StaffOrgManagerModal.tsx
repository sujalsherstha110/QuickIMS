import React, { useState } from 'react';
import { 
  X, Users, Layers, Clock, CheckCircle2, Plus, Edit2, Trash2, 
  Check, AlertTriangle, Sparkles, Shield, Info, Calendar
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  StaffRoleDefinition, StaffDepartmentDefinition, 
  StaffShiftDefinition, StaffStatusDefinition 
} from '../../types';

interface StaffOrgManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'roles' | 'departments' | 'shifts' | 'statuses';
}

const PRESET_COLORS = [
  '#4f46e5', '#0284c7', '#059669', '#d97706', '#dc2626', 
  '#7c3aed', '#db2777', '#0891b2', '#475569', '#16a34a'
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const StaffOrgManagerModal: React.FC<StaffOrgManagerModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'roles'
}) => {
  const { 
    staffRoles, addStaffRole, updateStaffRole, deleteStaffRole,
    staffDepartments, addStaffDepartment, updateStaffDepartment, deleteStaffDepartment,
    staffShifts, addStaffShift, updateStaffShift, deleteStaffShift,
    staffStatuses, addStaffStatus, updateStaffStatus, deleteStaffStatus,
    staffMembers
  } = useApp();

  const [activeTab, setActiveTab] = useState<'roles' | 'departments' | 'shifts' | 'statuses'>(initialTab);

  // Editing items
  const [editingRole, setEditingRole] = useState<StaffRoleDefinition | null>(null);
  const [editingDept, setEditingDept] = useState<StaffDepartmentDefinition | null>(null);
  const [editingShift, setEditingShift] = useState<StaffShiftDefinition | null>(null);
  const [editingStatus, setEditingStatus] = useState<StaffStatusDefinition | null>(null);

  // New item forms state
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', departmentDefault: 'Front of House', description: '' });

  const [isAddingDept, setIsAddingDept] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });

  const [isAddingShift, setIsAddingShift] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    name: '',
    startTime: '08:00',
    endTime: '16:00',
    color: '#0284c7',
    daysActive: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    notes: ''
  });

  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [statusForm, setStatusForm] = useState({ name: '', color: '#059669', description: '' });

  // Notifications
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  // ROLES HANDLERS
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim()) return;

    if (editingRole) {
      await updateStaffRole(editingRole.id, {
        name: roleForm.name.trim(),
        departmentDefault: roleForm.departmentDefault,
        description: roleForm.description.trim()
      });
      showNotice(`Updated role "${roleForm.name}".`);
      setEditingRole(null);
    } else {
      await addStaffRole({
        name: roleForm.name.trim(),
        departmentDefault: roleForm.departmentDefault,
        description: roleForm.description.trim()
      });
      showNotice(`Added new role "${roleForm.name}".`);
      setIsAddingRole(false);
    }
    setRoleForm({ name: '', departmentDefault: 'Front of House', description: '' });
  };

  const handleDeleteRole = async (role: StaffRoleDefinition) => {
    const assignedStaff = staffMembers.filter(s => s.role.toLowerCase() === role.name.toLowerCase() || s.role === role.id);
    if (assignedStaff.length > 0) {
      if (!confirm(`Warning: ${assignedStaff.length} staff member(s) currently have this role (${assignedStaff.map(s => s.name).join(', ')}). Delete anyway?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete role "${role.name}"?`)) return;
    }
    await deleteStaffRole(role.id);
    showNotice(`Deleted role "${role.name}".`);
  };

  // DEPARTMENTS HANDLERS
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name.trim()) return;

    if (editingDept) {
      await updateStaffDepartment(editingDept.id, {
        name: deptForm.name.trim(),
        description: deptForm.description.trim()
      });
      showNotice(`Updated department "${deptForm.name}".`);
      setEditingDept(null);
    } else {
      await addStaffDepartment({
        name: deptForm.name.trim(),
        description: deptForm.description.trim()
      });
      showNotice(`Added new department "${deptForm.name}".`);
      setIsAddingDept(false);
    }
    setDeptForm({ name: '', description: '' });
  };

  const handleDeleteDept = async (dept: StaffDepartmentDefinition) => {
    const assignedStaff = staffMembers.filter(s => s.department?.toLowerCase() === dept.name.toLowerCase());
    if (assignedStaff.length > 0) {
      if (!confirm(`Warning: ${assignedStaff.length} staff member(s) are assigned to this department. Delete anyway?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete department "${dept.name}"?`)) return;
    }
    await deleteStaffDepartment(dept.id);
    showNotice(`Deleted department "${dept.name}".`);
  };

  // SHIFTS HANDLERS
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.name.trim() || !shiftForm.startTime || !shiftForm.endTime) return;

    if (editingShift) {
      await updateStaffShift(editingShift.id, {
        name: shiftForm.name.trim(),
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        color: shiftForm.color,
        daysActive: shiftForm.daysActive,
        notes: shiftForm.notes.trim()
      });
      showNotice(`Updated shift "${shiftForm.name}".`);
      setEditingShift(null);
    } else {
      await addStaffShift({
        name: shiftForm.name.trim(),
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        color: shiftForm.color,
        daysActive: shiftForm.daysActive,
        notes: shiftForm.notes.trim()
      });
      showNotice(`Added new shift timetable "${shiftForm.name}".`);
      setIsAddingShift(false);
    }
    setShiftForm({
      name: '',
      startTime: '08:00',
      endTime: '16:00',
      color: '#0284c7',
      daysActive: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      notes: ''
    });
  };

  const handleDeleteShift = async (shift: StaffShiftDefinition) => {
    const assignedStaff = staffMembers.filter(s => s.shift === shift.name || s.shiftId === shift.id);
    if (assignedStaff.length > 0) {
      if (!confirm(`Warning: ${assignedStaff.length} staff member(s) are assigned to this shift. Delete anyway?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete shift "${shift.name}"?`)) return;
    }
    await deleteStaffShift(shift.id);
    showNotice(`Deleted shift "${shift.name}".`);
  };

  // STATUSES HANDLERS
  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusForm.name.trim()) return;

    if (editingStatus) {
      await updateStaffStatus(editingStatus.id, {
        name: statusForm.name.trim(),
        color: statusForm.color,
        description: statusForm.description.trim()
      });
      showNotice(`Updated status "${statusForm.name}".`);
      setEditingStatus(null);
    } else {
      await addStaffStatus({
        name: statusForm.name.trim(),
        color: statusForm.color,
        description: statusForm.description.trim()
      });
      showNotice(`Added new status "${statusForm.name}".`);
      setIsAddingStatus(false);
    }
    setStatusForm({ name: '', color: '#059669', description: '' });
  };

  const handleDeleteStatus = async (status: StaffStatusDefinition) => {
    const assignedStaff = staffMembers.filter(s => s.status?.toLowerCase() === status.name.toLowerCase() || s.status === status.id);
    if (assignedStaff.length > 0) {
      if (!confirm(`Warning: ${assignedStaff.length} staff currently have this status. Delete anyway?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete status "${status.name}"?`)) return;
    }
    await deleteStaffStatus(status.id);
    showNotice(`Deleted status "${status.name}".`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base">
                Organization Master Configurations
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage roles, departments, shift timetables & status definitions
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Notice Banner */}
        {notice && (
          <div className="px-6 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
        )}

        {/* Navigation Tabs (Segmented Control) */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-200/50 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('roles');
                setIsAddingRole(false);
                setEditingRole(null);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'roles'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Roles ({staffRoles.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('departments');
                setIsAddingDept(false);
                setEditingDept(null);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'departments'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Depts ({staffDepartments.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('shifts');
                setIsAddingShift(false);
                setEditingShift(null);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'shifts'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Shifts ({staffShifts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('statuses');
                setIsAddingStatus(false);
                setEditingStatus(null);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'statuses'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Statuses ({staffStatuses.length})</span>
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: ROLES & DESIGNATIONS */}
          {activeTab === 'roles' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Staff Roles & Designations</h3>
                  <p className="text-xs text-slate-500">Configure job titles, operational area associations, and permissions baseline</p>
                </div>
                {!isAddingRole && !editingRole && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingRole(true);
                      setRoleForm({ name: '', departmentDefault: staffDepartments[0]?.name || 'Front of House', description: '' });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Role</span>
                  </button>
                )}
              </div>

              {/* Add / Edit Form */}
              {(isAddingRole || editingRole) && (
                <form onSubmit={handleSaveRole} className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {editingRole ? `Edit Role: ${editingRole.name}` : 'New Role Definition'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingRole(false);
                        setEditingRole(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Role Title *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Senior Barista, Head Sommelier, Hostess"
                        value={roleForm.name}
                        onChange={e => setRoleForm({ ...roleForm, name: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Default Department
                      </label>
                      <select
                        value={roleForm.departmentDefault}
                        onChange={e => setRoleForm({ ...roleForm, departmentDefault: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {staffDepartments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Description / Duties
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Responsible for cocktail prep and bar stock counter"
                      value={roleForm.description}
                      onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingRole(false);
                        setEditingRole(null);
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                    >
                      {editingRole ? 'Save Changes' : 'Create Role'}
                    </button>
                  </div>
                </form>
              )}

              {/* Roles Table/List */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {staffRoles.map(role => {
                  const staffCount = staffMembers.filter(s => s.role.toLowerCase() === role.name.toLowerCase() || s.role === role.id).length;
                  return (
                    <div key={role.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                          {role.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-white capitalize">{role.name.replace(/_/g, ' ')}</span>
                            {role.departmentDefault && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {role.departmentDefault}
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              {staffCount} staff
                            </span>
                          </div>
                          {role.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{role.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRole(role);
                            setIsAddingRole(false);
                            setRoleForm({
                              name: role.name,
                              departmentDefault: role.departmentDefault || 'Front of House',
                              description: role.description || ''
                            });
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Role"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRole(role)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Delete Role"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Restaurant Operational Departments</h3>
                  <p className="text-xs text-slate-500">Divide venues into operational areas (Kitchen, Bar, Floor, Terrace, Bakery)</p>
                </div>
                {!isAddingDept && !editingDept && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingDept(true);
                      setDeptForm({ name: '', description: '' });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Department</span>
                  </button>
                )}
              </div>

              {/* Add / Edit Form */}
              {(isAddingDept || editingDept) && (
                <form onSubmit={handleSaveDept} className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {editingDept ? `Edit Department: ${editingDept.name}` : 'New Department Area'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingDept(false);
                        setEditingDept(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Department Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. VIP Lounge & Cigar Room, Pastry Workshop"
                      value={deptForm.name}
                      onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Description / Scope
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Covers 2nd floor balcony seating and patio drink station"
                      value={deptForm.description}
                      onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingDept(false);
                        setEditingDept(null);
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                    >
                      {editingDept ? 'Save Changes' : 'Create Department'}
                    </button>
                  </div>
                </form>
              )}

              {/* Department List */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {staffDepartments.map(dept => {
                  const staffCount = staffMembers.filter(s => s.department?.toLowerCase() === dept.name.toLowerCase()).length;
                  return (
                    <div key={dept.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
                          <Layers className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{dept.name}</span>
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              {staffCount} active staff
                            </span>
                          </div>
                          {dept.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{dept.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDept(dept);
                            setIsAddingDept(false);
                            setDeptForm({
                              name: dept.name,
                              description: dept.description || ''
                            });
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Department"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDept(dept)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Delete Department"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: SHIFT TIMETABLES */}
          {activeTab === 'shifts' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Shift Timetables & Rostering</h3>
                  <p className="text-xs text-slate-500">Configure structured timetable schedules with exact start and end times</p>
                </div>
                {!isAddingShift && !editingShift && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingShift(true);
                      setShiftForm({
                        name: '',
                        startTime: '08:00',
                        endTime: '16:00',
                        color: '#0284c7',
                        daysActive: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                        notes: ''
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Shift Timetable</span>
                  </button>
                )}
              </div>

              {/* Add / Edit Form */}
              {(isAddingShift || editingShift) && (
                <form onSubmit={handleSaveShift} className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {editingShift ? `Edit Shift: ${editingShift.name}` : 'New Shift Timetable'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingShift(false);
                        setEditingShift(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Shift Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Morning Breakfast Rush"
                        value={shiftForm.name}
                        onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Start Time (HH:MM) *
                      </label>
                      <input
                        type="time"
                        required
                        value={shiftForm.startTime}
                        onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        End Time (HH:MM) *
                      </label>
                      <input
                        type="time"
                        required
                        value={shiftForm.endTime}
                        onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Active Days */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                      Active Days of Week
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_OF_WEEK.map(day => {
                        const isSelected = shiftForm.daysActive.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const updated = isSelected 
                                ? shiftForm.daysActive.filter(d => d !== day)
                                : [...shiftForm.daysActive, day];
                              setShiftForm({ ...shiftForm, daysActive: updated });
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color Swatch & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Badge Color
                      </label>
                      <div className="flex items-center gap-1.5">
                        {PRESET_COLORS.slice(0, 6).map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setShiftForm({ ...shiftForm, color: c })}
                            className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                              shiftForm.color === c ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Notes / Handover Tasks
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Floor cleaning & closing checklist"
                        value={shiftForm.notes}
                        onChange={e => setShiftForm({ ...shiftForm, notes: e.target.value })}
                        className="w-full px-3.5 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingShift(false);
                        setEditingShift(null);
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                    >
                      {editingShift ? 'Save Changes' : 'Create Timetable'}
                    </button>
                  </div>
                </form>
              )}

              {/* Shifts List */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {staffShifts.map(shift => {
                  const staffCount = staffMembers.filter(s => s.shift === shift.name || s.shiftId === shift.id).length;
                  return (
                    <div key={shift.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3.5 h-10 rounded-lg shrink-0"
                          style={{ backgroundColor: shift.color || '#0284c7' }}
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{shift.name}</span>
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400">
                              {shift.startTime} – {shift.endTime}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {staffCount} assigned staff
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {(shift.daysActive || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']).map(d => (
                              <span key={d} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {d}
                              </span>
                            ))}
                            {shift.notes && (
                              <span className="text-[10px] text-slate-400 italic ml-1">
                                • {shift.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingShift(shift);
                            setIsAddingShift(false);
                            setShiftForm({
                              name: shift.name,
                              startTime: shift.startTime,
                              endTime: shift.endTime,
                              color: shift.color || '#0284c7',
                              daysActive: shift.daysActive || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                              notes: shift.notes || ''
                            });
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Shift"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteShift(shift)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Delete Shift"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: FLOOR STATUSES */}
          {activeTab === 'statuses' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Staff Floor & Duty Statuses</h3>
                  <p className="text-xs text-slate-500">Configure live operational statuses (Active, On Break, On Leave, In Training)</p>
                </div>
                {!isAddingStatus && !editingStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingStatus(true);
                      setStatusForm({ name: '', color: '#059669', description: '' });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Status</span>
                  </button>
                )}
              </div>

              {/* Add / Edit Form */}
              {(isAddingStatus || editingStatus) && (
                <form onSubmit={handleSaveStatus} className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {editingStatus ? `Edit Status: ${editingStatus.name}` : 'New Status Definition'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingStatus(false);
                        setEditingStatus(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Status Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Remote Support, On Sick Leave, Probation"
                        value={statusForm.name}
                        onChange={e => setStatusForm({ ...statusForm, name: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Color Theme
                      </label>
                      <div className="flex items-center gap-2">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setStatusForm({ ...statusForm, color: c })}
                            className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                              statusForm.color === c ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Staff is assigned to remote inventory audits"
                      value={statusForm.description}
                      onChange={e => setStatusForm({ ...statusForm, description: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingStatus(false);
                        setEditingStatus(null);
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                    >
                      {editingStatus ? 'Save Changes' : 'Create Status'}
                    </button>
                  </div>
                </form>
              )}

              {/* Statuses List */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {staffStatuses.map(status => {
                  const staffCount = staffMembers.filter(s => s.status?.toLowerCase() === status.name.toLowerCase() || s.status === status.id).length;
                  return (
                    <div key={status.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <span 
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: status.color || '#059669' }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{status.name}</span>
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              {staffCount} staff
                            </span>
                          </div>
                          {status.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{status.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStatus(status);
                            setIsAddingStatus(false);
                            setStatusForm({
                              name: status.name,
                              color: status.color || '#059669',
                              description: status.description || ''
                            });
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Status"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStatus(status)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Delete Status"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <p className="text-xs text-slate-500">
            Changes are saved instantly and sync across all terminals and staff profiles.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
