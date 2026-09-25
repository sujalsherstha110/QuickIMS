import React, { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Phone, Mail, Clock, ShieldCheck, 
  Search, Filter, CheckCircle2, Coffee, AlertCircle, Edit2, 
  Trash2, X, ChefHat, Wine, ShoppingCart, DollarSign
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StaffMember } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';

export const StaffView: React.FC = () => {
  const { staffMembers, addStaffMember, updateStaffMember, deleteStaffMember, diningTables } = useApp();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    role: StaffMember['role'];
    phone: string;
    email: string;
    shift: StaffMember['shift'];
    status: StaffMember['status'];
    salary: number;
    tablesAssigned: string[];
  }>({
    name: '',
    role: 'waiter',
    phone: '',
    email: '',
    shift: 'evening',
    status: 'active',
    salary: 22000,
    tablesAssigned: []
  });

  const filteredStaff = useMemo(() => {
    return staffMembers.filter(member => {
      const matchSearch = 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.phone.includes(searchTerm) ||
        (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchRole = selectedRole === 'all' || member.role === selectedRole;
      const matchShift = selectedShift === 'all' || member.shift === selectedShift;
      return matchSearch && matchRole && matchShift;
    });
  }, [staffMembers, searchTerm, selectedRole, selectedShift]);

  const activeCount = staffMembers.filter(s => s.status === 'active').length;
  const onBreakCount = staffMembers.filter(s => s.status === 'on_break').length;

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormData({
      name: '',
      role: 'waiter',
      phone: '+977-',
      email: '',
      shift: 'evening',
      status: 'active',
      salary: 25000,
      tablesAssigned: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name,
      role: staff.role,
      phone: staff.phone,
      email: staff.email || '',
      shift: staff.shift,
      status: staff.status,
      salary: staff.salary || 25000,
      tablesAssigned: staff.tablesAssigned || []
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;

    if (editingStaff) {
      await updateStaffMember(editingStaff.id, formData);
    } else {
      await addStaffMember({
        ...formData,
        joinedDate: new Date().toISOString().split('T')[0]
      });
    }
    setIsModalOpen(false);
  };

  const getRoleBadge = (role: StaffMember['role']) => {
    switch (role) {
      case 'head_chef':
        return { label: 'Head Chef', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-800' };
      case 'line_cook':
        return { label: 'Line Cook', color: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 border-orange-200 dark:border-orange-800' };
      case 'bartender':
        return { label: 'Bartender', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800' };
      case 'waiter':
        return { label: 'Floor Waiter', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' };
      case 'cashier':
        return { label: 'Cashier', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' };
      default:
        return { label: 'Manager', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-800' };
    }
  };

  const getRoleIcon = (role: StaffMember['role']) => {
    switch (role) {
      case 'head_chef':
      case 'line_cook':
        return <ChefHat className="w-4 h-4" />;
      case 'bartender':
        return <Wine className="w-4 h-4" />;
      case 'waiter':
        return <Users className="w-4 h-4" />;
      case 'cashier':
        return <ShoppingCart className="w-4 h-4" />;
      default:
        return <ShieldCheck className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Staff & Shift Directory</span>
            </h1>
            <span className="text-3xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/50">
              Manage FOH & BOH
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage restaurant team, assigned dining tables, duty shifts, and on-break statuses.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider">Total Staff</span>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">{staffMembers.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active On Duty</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{activeCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">On Break</span>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{onBreakCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Floor Tables</span>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{diningTables.length}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff name, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">All Roles</option>
            <option value="waiter">Waiters</option>
            <option value="head_chef">Head Chef</option>
            <option value="line_cook">Line Cook</option>
            <option value="bartender">Bartender</option>
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
          </select>

          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">All Shifts</option>
            <option value="morning">Morning Shift</option>
            <option value="evening">Evening Shift</option>
            <option value="night">Night Shift</option>
            <option value="full_day">Full Day</option>
          </select>
        </div>
      </div>

      {/* Staff Cards Grid */}
      {filteredStaff.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2">
          <Users className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No staff members match criteria</p>
          <p className="text-xs text-slate-400">Try adjusting your role or shift filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map(staff => {
            const roleBadge = getRoleBadge(staff.role);
            return (
              <div 
                key={staff.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs hover:shadow-xs transition-all space-y-3.5 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar of card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-sm">
                        {staff.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                          {staff.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`inline-flex items-center gap-1 text-3xs font-semibold px-2 py-0.5 rounded-md border ${roleBadge.color}`}>
                            {getRoleIcon(staff.role)}
                            {roleBadge.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        const nextStatus: StaffMember['status'] = 
                          staff.status === 'active' ? 'on_break' : 
                          staff.status === 'on_break' ? 'off_duty' : 'active';
                        updateStaffMember(staff.id, { status: nextStatus });
                      }}
                      className={`text-3xs font-bold px-2 py-1 rounded-full cursor-pointer transition-all border ${
                        staff.status === 'active' 
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                          : staff.status === 'on_break'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                      }`}
                      title="Click to toggle status"
                    >
                      {staff.status === 'active' && '● Active'}
                      {staff.status === 'on_break' && '☕ On Break'}
                      {staff.status === 'off_duty' && '○ Off Duty'}
                    </button>
                  </div>

                  {/* Contact & Shift Info */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Phone className="w-3.5 h-3.5" />
                        <span>Phone:</span>
                      </span>
                      <a href={`tel:${staff.phone}`} className="font-medium text-slate-900 dark:text-slate-200 hover:underline">
                        {staff.phone}
                      </a>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Shift:</span>
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                        {staff.shift.replace('_', ' ')}
                      </span>
                    </div>

                    {staff.tablesAssigned && staff.tablesAssigned.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-start justify-between gap-2">
                        <span className="text-3xs text-slate-500 font-medium">Assigned Tables:</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {staff.tablesAssigned.map(tbl => (
                            <span key={tbl} className="text-3xs px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                              {tbl}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-3xs text-slate-400 font-mono">
                    Joined: {staff.joinedDate}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(staff)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Edit Staff"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${staff.name} from staff directory?`)) {
                          deleteStaffMember(staff.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Delete Staff"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>{editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4.5 space-y-3.5">
              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Suresh Thapa"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as StaffMember['role'] })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="waiter">Floor Waiter</option>
                    <option value="head_chef">Head Chef</option>
                    <option value="line_cook">Line Cook</option>
                    <option value="bartender">Bartender</option>
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Shift *
                  </label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value as StaffMember['shift'] })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="morning">Morning Shift</option>
                    <option value="evening">Evening Shift</option>
                    <option value="night">Night Shift</option>
                    <option value="full_day">Full Day</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+977-98..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Monthly Salary (NPR)
                  </label>
                  <input
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Assigned Tables (Comma separated, e.g. M-01, M-02, R-01)
                </label>
                <input
                  type="text"
                  value={formData.tablesAssigned.join(', ')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    tablesAssigned: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                  })}
                  placeholder="M-01, M-02, B-01"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
                >
                  {editingStaff ? 'Save Changes' : 'Create Staff Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
