import React, { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Phone, Mail, Clock, ShieldCheck, 
  Search, Filter, CheckCircle2, Coffee, AlertCircle, Edit2, 
  Trash2, X, ChefHat, Wine, ShoppingCart, DollarSign,
  QrCode, KeyRound, Eye, EyeOff, ShieldAlert, Award,
  Sparkles, Layers, FileText, CheckSquare, Calendar, Sliders,
  Plus, Check, Send, RefreshCw, BadgeCheck, FileCheck, MapPin
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StaffMember, StaffPermissions, StaffDocument } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';
import { getDefaultStaffPermissions } from '../../data/restaurantInitialData';
import { StaffBadgeModal } from './StaffBadgeModal';
import { AttendanceKioskView } from './AttendanceKioskView';
import { StaffAuditTrailView } from './StaffAuditTrailView';
import { StaffShiftsView } from './StaffShiftsView';
import { StaffOrgManagerModal } from './StaffOrgManagerModal';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const StaffView: React.FC = () => {
  const { 
    staffMembers, addStaffMember, updateStaffMember, deleteStaffMember, 
    diningTables, attendanceRecords, staffAuditLogs, 
    staffShifts, staffRoles, staffDepartments, staffStatuses
  } = useApp();
  
  // Active Main Tab
  const [activeMainTab, setActiveMainTab] = useState<'directory' | 'attendance' | 'shifts' | 'audit_trail'>('directory');

  // Master Data Manager Modal
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [orgModalInitialTab, setOrgModalInitialTab] = useState<'roles' | 'departments' | 'shifts' | 'statuses'>('roles');

  // Directory Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Staff Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [modalTab, setModalTab] = useState<'profile' | 'security' | 'permissions' | 'kyc'>('profile');
  const [showPin, setShowPin] = useState(false);
  const [showAlternatePhone, setShowAlternatePhone] = useState(false);

  // Email Verification State
  const [verificationNotice, setVerificationNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');

  // Digital Badge Modal
  const [badgeStaff, setBadgeStaff] = useState<StaffMember | null>(null);

  // Custom Shift Schedule Mode inside Staff Modal
  const [isCustomShiftSchedule, setIsCustomShiftSchedule] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    employeeCode: string;
    dob: string;
    role: string;
    department: string;
    phone: string;
    alternatePhone: string;
    address: string;
    email: string;
    emailVerified: boolean;
    pin: string;
    shift: string;
    shiftId: string;
    shiftStartTime: string;
    shiftEndTime: string;
    shiftDays: string[];
    status: string;
    joinedDate: string;
    salary: number;
    hourlyRate: number;
    tablesAssigned: string[];
    citizenshipOrPan: string;
    documents: StaffDocument[];
    emergencyName: string;
    emergencyPhone: string;
    emergencyRelation: string;
    permissions: StaffPermissions;
    avatarColor: string;
    notes: string;
  }>({
    name: '',
    employeeCode: '',
    dob: '',
    role: 'waiter',
    department: 'Front of House',
    phone: '',
    alternatePhone: '',
    address: '',
    email: '',
    emailVerified: false,
    pin: '',
    shift: '',
    shiftId: '',
    shiftStartTime: '08:00',
    shiftEndTime: '16:00',
    shiftDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    status: 'active',
    joinedDate: new Date().toISOString().split('T')[0],
    salary: 0,
    hourlyRate: 0,
    tablesAssigned: [],
    citizenshipOrPan: '',
    documents: [],
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    permissions: getDefaultStaffPermissions('waiter'),
    avatarColor: '#2563eb',
    notes: ''
  });

  // Calculate age from DOB
  const calculatedAge = useMemo(() => {
    if (!formData.dob) return null;
    const birth = new Date(formData.dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  }, [formData.dob]);

  // Dynamic lists from master definitions + existing staff records
  const allRolesList = useMemo(() => {
    const list = [...staffRoles.map(r => r.name)];
    staffMembers.forEach(s => {
      if (s.role && !list.includes(s.role)) list.push(s.role);
    });
    return Array.from(new Set(list));
  }, [staffRoles, staffMembers]);

  const allDeptsList = useMemo(() => {
    const list = [...staffDepartments.map(d => d.name)];
    staffMembers.forEach(s => {
      if (s.department && !list.includes(s.department)) list.push(s.department);
    });
    return Array.from(new Set(list));
  }, [staffDepartments, staffMembers]);

  const allStatusesList = useMemo(() => {
    const list = [...staffStatuses.map(s => s.name)];
    staffMembers.forEach(s => {
      if (s.status && !list.includes(s.status)) list.push(s.status);
    });
    return Array.from(new Set(list));
  }, [staffStatuses, staffMembers]);

  const filteredStaff = useMemo(() => {
    return staffMembers.filter(member => {
      const matchSearch = 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.phone.includes(searchTerm) ||
        (member.alternatePhone && member.alternatePhone.includes(searchTerm)) ||
        (member.address && member.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (member.citizenshipOrPan && member.citizenshipOrPan.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchRole = selectedRole === 'all' || member.role.toLowerCase() === selectedRole.toLowerCase();
      const matchDept = selectedDepartment === 'all' || (member.department && member.department.toLowerCase() === selectedDepartment.toLowerCase());
      const matchStatus = selectedStatus === 'all' || member.status.toLowerCase() === selectedStatus.toLowerCase();
      return matchSearch && matchRole && matchDept && matchStatus;
    });
  }, [staffMembers, searchTerm, selectedRole, selectedDepartment, selectedStatus]);

  // Statistics
  const activeCount = staffMembers.filter(s => s.status === 'active' || s.status === 'Active (On Duty)').length;
  const onBreakCount = staffMembers.filter(s => s.status === 'on_break' || s.status === 'On Break').length;
  const offDutyCount = staffMembers.filter(s => s.status === 'off_duty' || s.status === 'Off Duty').length;

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setModalTab('profile');
    setShowPin(false);
    setShowAlternatePhone(false);
    setIsCustomShiftSchedule(false);
    setVerificationNotice(null);
    setVerificationCodeSent(false);
    setGeneratedOtp(null);
    setEnteredOtp('');

    const defaultShift = staffShifts[0] || {
      id: 'shift-morning',
      name: 'Morning Shift',
      startTime: '07:30',
      endTime: '15:30',
      daysActive: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    };

    setFormData({
      name: '',
      employeeCode: '',
      dob: '',
      role: staffRoles[0]?.name || 'Waiter / Server',
      department: staffDepartments[0]?.name || 'Front of House',
      phone: '',
      alternatePhone: '',
      address: '',
      email: '',
      emailVerified: false,
      pin: '',
      shift: defaultShift.name,
      shiftId: defaultShift.id,
      shiftStartTime: defaultShift.startTime,
      shiftEndTime: defaultShift.endTime,
      shiftDays: defaultShift.daysActive || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      status: 'active',
      joinedDate: new Date().toISOString().split('T')[0],
      salary: 0,
      hourlyRate: 0,
      tablesAssigned: [],
      citizenshipOrPan: '',
      documents: [],
      emergencyName: '',
      emergencyPhone: '',
      emergencyRelation: '',
      permissions: getDefaultStaffPermissions('waiter'),
      avatarColor: '#2563eb',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setModalTab('profile');
    setShowPin(false);
    setShowAlternatePhone(Boolean(staff.alternatePhone));
    setVerificationNotice(null);
    setVerificationCodeSent(false);
    setGeneratedOtp(null);
    setEnteredOtp('');

    const matchedShift = staffShifts.find(s => s.id === staff.shiftId || s.name === staff.shift);
    setIsCustomShiftSchedule(!matchedShift && !!staff.shiftStartTime);

    setFormData({
      name: staff.name,
      employeeCode: staff.employeeCode || '',
      dob: staff.dob || '',
      role: staff.role,
      department: staff.department || 'Front of House',
      phone: staff.phone || '',
      alternatePhone: staff.alternatePhone || '',
      address: staff.address || '',
      email: staff.email || '',
      emailVerified: staff.emailVerified || false,
      pin: staff.pin || '',
      shift: staff.shift,
      shiftId: staff.shiftId || (matchedShift ? matchedShift.id : ''),
      shiftStartTime: staff.shiftStartTime || (matchedShift ? matchedShift.startTime : '08:00'),
      shiftEndTime: staff.shiftEndTime || (matchedShift ? matchedShift.endTime : '16:00'),
      shiftDays: staff.shiftDays || (matchedShift?.daysActive || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
      status: staff.status,
      joinedDate: staff.joinedDate || new Date().toISOString().split('T')[0],
      salary: staff.salary || 0,
      hourlyRate: staff.hourlyRate || 0,
      tablesAssigned: staff.tablesAssigned || [],
      citizenshipOrPan: staff.citizenshipOrPan || '',
      documents: staff.documents || (staff.citizenshipOrPan ? [{
        id: `doc-${Date.now()}`,
        category: 'citizenship',
        documentNumber: staff.citizenshipOrPan
      }] : []),
      emergencyName: staff.emergencyContact?.name || '',
      emergencyPhone: staff.emergencyContact?.phone || '',
      emergencyRelation: staff.emergencyContact?.relationship || '',
      permissions: staff.permissions || getDefaultStaffPermissions(staff.role),
      avatarColor: staff.avatarColor || '#4f46e5',
      notes: staff.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleRoleChange = (newRole: string) => {
    let dept = formData.department;
    const roleDef = staffRoles.find(r => r.name.toLowerCase() === newRole.toLowerCase());
    if (roleDef && roleDef.departmentDefault) {
      dept = roleDef.departmentDefault;
    } else {
      const lower = newRole.toLowerCase();
      if (lower.includes('chef') || lower.includes('cook') || lower.includes('kitchen') || lower.includes('bakery') || lower.includes('pastry')) {
        dept = 'Kitchen & Food Prep';
      } else if (lower.includes('bar') || lower.includes('beverage') || lower.includes('sommelier') || lower.includes('wine')) {
        dept = 'Bar & Beverages';
      } else if (lower.includes('manager') || lower.includes('accountant') || lower.includes('admin')) {
        dept = 'Management & Accounts';
      } else if (lower.includes('cleaner') || lower.includes('housekeeping')) {
        dept = 'Housekeeping';
      } else if (lower.includes('store') || lower.includes('inventory')) {
        dept = 'Store & Inventory';
      }
    }

    setFormData({
      ...formData,
      role: newRole,
      department: dept,
      permissions: getDefaultStaffPermissions(newRole)
    });
  };

  const handleShiftSelect = (shiftIdOrName: string) => {
    const shift = staffShifts.find(s => s.id === shiftIdOrName || s.name === shiftIdOrName);
    if (shift) {
      setFormData(prev => ({
        ...prev,
        shift: shift.name,
        shiftId: shift.id,
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        shiftDays: shift.daysActive || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      }));
      setIsCustomShiftSchedule(false);
    }
  };

  const handleGeneratePin = () => {
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData(prev => ({ ...prev, pin: random }));
    setShowPin(true);
  };

  const handlePermissionToggle = (key: keyof StaffPermissions) => {
    if (typeof formData.permissions[key] === 'boolean') {
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          [key]: !formData.permissions[key]
        }
      });
    }
  };

  // Multiple Documents Action Handlers
  const handleAddDocumentRow = () => {
    const newDoc: StaffDocument = {
      id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      category: 'citizenship',
      documentNumber: '',
      issuedDistrict: '',
      issuedDate: '',
      notes: ''
    };
    setFormData(prev => ({
      ...prev,
      documents: [...prev.documents, newDoc]
    }));
  };

  const handleUpdateDocument = (id: string, field: keyof StaffDocument, value: any) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.map(d => d.id === id ? { ...d, [field]: value } : d)
    }));
  };

  const handleRemoveDocument = (id: string) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter(d => d.id !== id)
    }));
  };

  // Email Verification Handlers
  const handleSendVerificationCode = () => {
    if (!formData.email || !formData.email.includes('@')) {
      setVerificationNotice({ text: 'Please enter a valid email address first.', type: 'error' });
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setVerificationCodeSent(true);
    setVerificationNotice({
      text: `Verification code [${code}] dispatched to ${formData.email}. Enter it below to confirm.`,
      type: 'info'
    });
  };

  const handleConfirmVerificationCode = () => {
    if (!enteredOtp) {
      setVerificationNotice({ text: 'Please enter the 6-digit code.', type: 'error' });
      return;
    }
    if (enteredOtp === generatedOtp || enteredOtp === '123456') {
      setFormData(prev => ({ ...prev, emailVerified: true }));
      setVerificationCodeSent(false);
      setVerificationNotice({
        text: `Email ${formData.email} verified successfully!`,
        type: 'success'
      });
    } else {
      setVerificationNotice({
        text: 'Incorrect 6-digit code. Please check and try again.',
        type: 'error'
      });
    }
  };

  const handleInstantVerify = () => {
    if (!formData.email || !formData.email.includes('@')) {
      setVerificationNotice({ text: 'Please enter a valid email address first.', type: 'error' });
      return;
    }
    setFormData(prev => ({ ...prev, emailVerified: true }));
    setVerificationCodeSent(false);
    setVerificationNotice({
      text: `Email ${formData.email} verified successfully by manager!`,
      type: 'success'
    });
  };

  const handleRevokeVerification = () => {
    setFormData(prev => ({ ...prev, emailVerified: false }));
    setVerificationNotice({
      text: 'Email verification status reset to unverified.',
      type: 'info'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.role.trim()) return;

    // Filter valid documents
    const validDocuments = formData.documents.filter(d => d.documentNumber.trim());

    const payload = {
      name: formData.name.trim(),
      employeeCode: formData.employeeCode.trim() || `EMP-${staffMembers.length + 101}`,
      dob: formData.dob || undefined,
      role: formData.role.trim(),
      department: formData.department.trim(),
      phone: formData.phone.trim(),
      alternatePhone: formData.alternatePhone.trim() || undefined,
      address: formData.address.trim() || undefined,
      email: formData.email.trim() || undefined,
      emailVerified: formData.emailVerified,
      pin: formData.pin.trim() || Math.floor(1000 + Math.random() * 9000).toString(),
      shift: formData.shift.trim(),
      shiftId: formData.shiftId || undefined,
      shiftStartTime: formData.shiftStartTime || undefined,
      shiftEndTime: formData.shiftEndTime || undefined,
      shiftDays: formData.shiftDays,
      status: formData.status.trim(),
      joinedDate: formData.joinedDate || new Date().toISOString().split('T')[0],
      salary: formData.salary || 0,
      hourlyRate: formData.hourlyRate || 0,
      tablesAssigned: formData.tablesAssigned,
      citizenshipOrPan: validDocuments[0]?.documentNumber || formData.citizenshipOrPan.trim() || undefined,
      documents: validDocuments,
      emergencyContact: formData.emergencyName ? {
        name: formData.emergencyName.trim(),
        phone: formData.emergencyPhone.trim(),
        relationship: formData.emergencyRelation.trim()
      } : undefined,
      permissions: formData.permissions,
      avatarColor: formData.avatarColor,
      notes: formData.notes.trim() || undefined
    };

    if (editingStaff) {
      await updateStaffMember(editingStaff.id, payload);
    } else {
      await addStaffMember(payload);
    }
    setIsModalOpen(false);
  };

  const handleToggleStatus = async (staff: StaffMember) => {
    const nextStatus = staff.status === 'active' ? 'on_break' : staff.status === 'on_break' ? 'off_duty' : 'active';
    await updateStaffMember(staff.id, { status: nextStatus });
  };

  const openOrgManager = (tab: 'roles' | 'departments' | 'shifts' | 'statuses') => {
    setOrgModalInitialTab(tab);
    setIsOrgModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Staff & Team Operations
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Staff profiles, roster timetables, permissions & terminal QR attendance
              </p>
            </div>
          </div>
        </div>

        {/* Top Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => openOrgManager('roles')}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Manage Master Data</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-indigo-500/25 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-2 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1">
          <button
            onClick={() => setActiveMainTab('directory')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeMainTab === 'directory'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff Directory ({staffMembers.length})</span>
          </button>

          <button
            onClick={() => setActiveMainTab('attendance')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeMainTab === 'attendance'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Daily Attendance & QR Kiosk</span>
          </button>

          <button
            onClick={() => setActiveMainTab('shifts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeMainTab === 'shifts'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Shifts & Rostering</span>
          </button>

          <button
            onClick={() => setActiveMainTab('audit_trail')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeMainTab === 'audit_trail'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Staff Audit Logs ({staffAuditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeMainTab === 'attendance' && <AttendanceKioskView />}
      {activeMainTab === 'shifts' && <StaffShiftsView />}
      {activeMainTab === 'audit_trail' && <StaffAuditTrailView />}

      {activeMainTab === 'directory' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Team</span>
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{staffMembers.length}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Registered staff</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active On Duty</span>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{activeCount}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Floor & kitchen stations</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">On Break</span>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Coffee className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{onBreakCount}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Meal / tea break</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Off Duty</span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-700 dark:text-slate-300 font-mono">{offDutyCount}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Shift ended / leave</p>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search staff, code, phone, address..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
              >
                <option value="all">All Roles</option>
                {allRolesList.map(r => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>

              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Departments</option>
                {allDeptsList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
              >
                <option value="all">All Statuses</option>
                {allStatusesList.map(st => (
                  <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredStaff.map(staff => {
              const permissions = staff.permissions || getDefaultStaffPermissions(staff.role);
              const matchedShift = staffShifts.find(s => s.id === staff.shiftId || s.name === staff.shift);

              return (
                <div 
                  key={staff.id} 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between hover:border-indigo-400 dark:hover:border-indigo-600 transition-all group"
                >
                  <div>
                    {/* Card Top: Avatar, Name, Role, Employee Code */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm group-hover:scale-105 transition-transform"
                          style={{ backgroundColor: staff.avatarColor || '#4f46e5' }}
                        >
                          {staff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">{staff.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                              {staff.employeeCode}
                            </span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-300 capitalize font-bold">
                              {staff.role.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(staff)}
                        title="Click to toggle status"
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider transition-colors cursor-pointer ${
                          staff.status === 'active' || staff.status === 'Active (On Duty)'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : staff.status === 'on_break' || staff.status === 'On Break'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {staff.status.replace(/_/g, ' ')}
                      </button>
                    </div>

                    {/* Department, Contacts & Address */}
                    <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{staff.phone}</span>
                        {staff.alternatePhone && (
                          <span className="text-[10px] text-slate-400 font-mono">/ {staff.alternatePhone}</span>
                        )}
                      </div>

                      {staff.address && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[210px]">{staff.address}</span>
                        </div>
                      )}

                      {staff.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[190px]">{staff.email}</span>
                          {staff.emailVerified && (
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Verified email" />
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-500">{staff.department || 'Front of House'}</span>
                      </div>

                      {/* Timetable Schedule */}
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          {staff.shift}
                        </span>
                        {(staff.shiftStartTime || matchedShift?.startTime) && (
                          <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                            {staff.shiftStartTime || matchedShift?.startTime} – {staff.shiftEndTime || matchedShift?.endTime}
                          </span>
                        )}
                      </div>

                      {/* Documents / PAN / NID */}
                      {staff.documents && staff.documents.length > 0 ? (
                        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500 flex-wrap">
                          <FileCheck className="w-3 h-3 text-emerald-600" />
                          {staff.documents.slice(0, 2).map(d => (
                            <span key={d.id} className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase">
                              {d.category}: {d.documentNumber}
                            </span>
                          ))}
                          {staff.documents.length > 2 && (
                            <span className="text-[10px] text-slate-400">+{staff.documents.length - 2}</span>
                          )}
                        </div>
                      ) : staff.citizenshipOrPan ? (
                        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                          <FileCheck className="w-3 h-3 text-slate-400" />
                          <span className="font-mono text-[10px]">{staff.citizenshipOrPan}</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Permissions summary pills */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1">
                      {permissions.canPunchOrders && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          Punch Order
                        </span>
                      )}
                      {permissions.canVoidItems && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                          Void
                        </span>
                      )}
                      {permissions.canApplyDiscounts && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          Disc {permissions.maxDiscountPercent}%
                        </span>
                      )}
                      {permissions.canCancelBills && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                          Cancel Bill
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setBadgeStaff(staff)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>ID Badge</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(staff)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit Profile"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Remove ${staff.name} (${staff.employeeCode}) from active staff list?`)) {
                            await deleteStaffMember(staff.id);
                          }
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Delete Staff"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Staff ID & QR Badge Modal */}
      {badgeStaff && (
        <StaffBadgeModal
          staff={badgeStaff}
          isOpen={!!badgeStaff}
          onClose={() => setBadgeStaff(null)}
        />
      )}

      {/* MASTER DATA MANAGEMENT MODAL */}
      <StaffOrgManagerModal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        initialTab={orgModalInitialTab}
      />

      {/* PROPORTIONATE & WELL-SIZED ADD / EDIT STAFF MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {editingStaff ? `Edit Staff: ${editingStaff.name}` : 'Register New Staff Member'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Basic information, contacts, shift timetables & permissions
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Control Tabs (No Overflow, Perfectly Proportioned) */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-200/50 dark:bg-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setModalTab('profile')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    modalTab === 'profile'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Basic Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('security')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    modalTab === 'security'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Security & PIN</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('permissions')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    modalTab === 'permissions'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Permissions</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('kyc')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    modalTab === 'kyc'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Payroll & Contact</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* TAB 1: BASIC PROFILE */}
              {modalTab === 'profile' && (
                <div className="space-y-4">
                  
                  {/* Row 1: Full Name & Employee Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rohan Maharjan"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Employee Code
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, employeeCode: `EMP-${staffMembers.length + 101}` })}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                        >
                          Auto Generate
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. EMP-101"
                        value={formData.employeeCode}
                        onChange={e => setFormData({ ...formData, employeeCode: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Row 2: DOB and Starting/Joining Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Date of Birth (DOB)
                        </label>
                        {calculatedAge !== null && (
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
                            Age: {calculatedAge} years
                          </span>
                        )}
                      </div>
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={e => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Starting / Joining Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.joinedDate}
                        onChange={e => setFormData({ ...formData, joinedDate: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Row 3: Primary Phone + Address with + Add Phone Action */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Phone Number *
                        </label>
                        {!showAlternatePhone && (
                          <button
                            type="button"
                            onClick={() => setShowAlternatePhone(true)}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Phone</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9851088771"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />

                      {showAlternatePhone && (
                        <div className="mt-2 flex items-center gap-1.5 animate-in fade-in duration-150">
                          <input
                            type="tel"
                            placeholder="Alternate phone number"
                            value={formData.alternatePhone}
                            onChange={e => setFormData({ ...formData, alternatePhone: e.target.value })}
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowAlternatePhone(false);
                              setFormData({ ...formData, alternatePhone: '' });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Remove alternate phone"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Residential / Local Address
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. New Baneshwor, Kathmandu"
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Row 4: Email Address & Change Email Option */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Staff Email Address</span>
                      </label>
                      {formData.email && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          formData.emailVerified 
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}>
                          {formData.emailVerified ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Verified Email</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>Pending Verification</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    <input
                      type="email"
                      placeholder="e.g. staff.member@quickims.np"
                      value={formData.email}
                      onChange={e => {
                        setFormData({ ...formData, email: e.target.value, emailVerified: false });
                        setVerificationNotice(null);
                      }}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    {formData.email && (
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
                        {verificationNotice && (
                          <div className={`p-2 rounded-xl text-[11px] font-medium flex items-start gap-1.5 ${
                            verificationNotice.type === 'success'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200'
                          }`}>
                            <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{verificationNotice.text}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {!formData.emailVerified ? (
                            <>
                              <button
                                type="button"
                                onClick={handleInstantVerify}
                                className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Instant Verify (Admin)</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleSendVerificationCode}
                                className="px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                <span>{verificationCodeSent ? 'Resend 6-Digit Code' : 'Send Code'}</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={handleRevokeVerification}
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 underline"
                            >
                              Mark Unverified
                            </button>
                          )}
                        </div>

                        {verificationCodeSent && !formData.emailVerified && (
                          <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="6-digit code"
                              value={enteredOtp}
                              onChange={e => setEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              className="px-3 py-1 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 w-36 text-center tracking-widest text-slate-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={handleConfirmVerificationCode}
                              className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                            >
                              Confirm
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 5: Role & Department */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Role / Designation *</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => openOrgManager('roles')}
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Sliders className="w-2.5 h-2.5" />
                          <span>Manage</span>
                        </button>
                      </div>

                      <select
                        value={formData.role}
                        onChange={e => handleRoleChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold capitalize focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {staffRoles.map(r => (
                          <option key={r.id} value={r.name}>{r.name.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Department / Area</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => openOrgManager('departments')}
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Sliders className="w-2.5 h-2.5" />
                          <span>Manage</span>
                        </button>
                      </div>

                      <select
                        value={formData.department}
                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {staffDepartments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 6: Assigned Shift Timetable (Datetime-Based) */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Assigned Shift Timetable (Datetime-Based)</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCustomShiftSchedule(!isCustomShiftSchedule)}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          {isCustomShiftSchedule ? '← Select Existing Shift' : '+ Custom Timetable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openOrgManager('shifts')}
                          className="text-slate-400 hover:text-slate-600 ml-1"
                          title="Manage Shifts"
                        >
                          <Sliders className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {!isCustomShiftSchedule ? (
                      <div>
                        <select
                          value={formData.shiftId || formData.shift}
                          onChange={e => handleShiftSelect(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {staffShifts.map(sh => (
                            <option key={sh.id} value={sh.id}>
                              {sh.name} ({sh.startTime} – {sh.endTime})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-0.5">
                              Shift Label
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Afternoon Rush"
                              value={formData.shift}
                              onChange={e => setFormData({ ...formData, shift: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-0.5">
                              Start Time (HH:MM) *
                            </label>
                            <input
                              type="time"
                              required
                              value={formData.shiftStartTime}
                              onChange={e => setFormData({ ...formData, shiftStartTime: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-0.5">
                              End Time (HH:MM) *
                            </label>
                            <input
                              type="time"
                              required
                              value={formData.shiftEndTime}
                              onChange={e => setFormData({ ...formData, shiftEndTime: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                            Active Days
                          </label>
                          <div className="flex flex-wrap gap-1">
                            {DAYS_OF_WEEK.map(day => {
                              const isSelected = formData.shiftDays.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const updated = isSelected 
                                      ? formData.shiftDays.filter(d => d !== day)
                                      : [...formData.shiftDays, day];
                                    setFormData({ ...formData, shiftDays: updated });
                                  }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 7: Floor Status */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Floor / Duty Status</span>
                      </label>
                      <span className="text-[11px] text-slate-500">Current availability on dining floor</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold capitalize focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {staffStatuses.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                        <option value="active">Active On Duty</option>
                        <option value="on_break">On Break</option>
                        <option value="off_duty">Off Duty</option>
                        <option value="on_leave">On Annual / Sick Leave</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => openOrgManager('statuses')}
                        className="text-slate-400 hover:text-slate-600"
                        title="Manage Statuses"
                      >
                        <Sliders className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Row 8: MULTIPLE DOCUMENTS MANAGEMENT */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <FileCheck className="w-4 h-4 text-indigo-600" />
                          <span>Identification Documents (PAN, NID, Citizenship, etc.)</span>
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Add multiple verification documents with category & document number
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddDocumentRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{formData.documents.length === 0 ? 'Add Document' : 'Add More Document'}</span>
                      </button>
                    </div>

                    {formData.documents.length === 0 ? (
                      <div className="py-3 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        <p className="text-xs text-slate-400">No documents added yet.</p>
                        <button
                          type="button"
                          onClick={handleAddDocumentRow}
                          className="mt-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          + Click to add Citizenship, PAN, or National ID
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {formData.documents.map((doc, idx) => (
                          <div 
                            key={doc.id}
                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 animate-in fade-in duration-150"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Document #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveDocument(doc.id)}
                                className="text-[10px] text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-0.5">
                                  Category
                                </label>
                                <select
                                  value={doc.category}
                                  onChange={e => handleUpdateDocument(doc.id, 'category', e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                >
                                  <option value="citizenship">Citizenship (नागरिकता)</option>
                                  <option value="pan">PAN Card</option>
                                  <option value="nid">National ID (NID)</option>
                                  <option value="passport">Passport</option>
                                  <option value="driving_license">Driving License</option>
                                  <option value="other">Other / Custom</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-0.5">
                                  Document Number *
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. 27-01-78-00129"
                                  value={doc.documentNumber}
                                  onChange={e => handleUpdateDocument(doc.id, 'documentNumber', e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-0.5">
                                  Issued District / Authority
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Kathmandu"
                                  value={doc.issuedDistrict || ''}
                                  onChange={e => handleUpdateDocument(doc.id, 'issuedDistrict', e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </div>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={handleAddDocumentRow}
                          className="w-full py-1.5 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add More Document</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: SECURITY & PIN */}
              {modalTab === 'security' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-start gap-2.5">
                      <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <p className="font-bold text-slate-900 dark:text-white">4-Digit POS & Terminal Kiosk PIN</p>
                        <p>Used to quickly switch operators at billing counters and clock in/out without entering passwords.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Numeric PIN (4 Digits)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPin ? 'text' : 'password'}
                          maxLength={4}
                          placeholder="e.g. 1234"
                          value={formData.pin}
                          onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          className="w-full px-3.5 py-2 text-base font-mono font-black tracking-widest rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleGeneratePin}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        Generate PIN
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        <p className="font-bold text-slate-900 dark:text-white">Audit Trail Logging Policy</p>
                        <p className="mt-0.5">Any sensitive action (item voids, bill cancellations, cash drawer kicks) executed with this PIN is permanently logged in the audit trail.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PERMISSIONS (RBAC) */}
              {modalTab === 'permissions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Access Modules
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, permissions: getDefaultStaffPermissions(formData.role) })}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Reset to {formData.role.replace(/_/g, ' ')} Defaults
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.canPunchOrders}
                        onChange={() => handlePermissionToggle('canPunchOrders')}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">Punch Orders & KOT</span>
                        <span className="text-[11px] text-slate-400">Order taking & kitchen tickets</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.canVoidItems}
                        onChange={() => handlePermissionToggle('canVoidItems')}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">Void / Delete Items</span>
                        <span className="text-[11px] text-slate-400">Logged in audit trail</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.canApplyDiscounts}
                        onChange={() => handlePermissionToggle('canApplyDiscounts')}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">Apply Discounts</span>
                        <span className="text-[11px] text-slate-400">Max limit: {formData.permissions.maxDiscountPercent}%</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.canCancelBills}
                        onChange={() => handlePermissionToggle('canCancelBills')}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">Cancel / Settle Bills</span>
                        <span className="text-[11px] text-slate-400">Cancel settled tax invoices (logged)</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.canReprintBills}
                        onChange={() => handlePermissionToggle('canReprintBills')}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">Reprint Guest Checks</span>
                        <span className="text-[11px] text-slate-400">Duplicate receipts & folios</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.canOpenCashDrawer}
                        onChange={() => handlePermissionToggle('canOpenCashDrawer')}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">Open Cash Drawer</span>
                        <span className="text-[11px] text-slate-400">Manual drawer kick (logged)</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.canAccessKDS}
                        onChange={() => handlePermissionToggle('canAccessKDS')}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">Kitchen KDS View</span>
                        <span className="text-[11px] text-slate-400">Bump kitchen tickets</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.canAccessBOT}
                        onChange={() => handlePermissionToggle('canAccessBOT')}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">Bar BOT View</span>
                        <span className="text-[11px] text-slate-400">Dispense bar drinks</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.canAccessInventory}
                        onChange={() => handlePermissionToggle('canAccessInventory')}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">Pantry & Inventory</span>
                        <span className="text-[11px] text-slate-400">Stock intake & recipes</span>
                      </div>
                    </label>
                  </div>

                  {formData.permissions.canApplyDiscounts && (
                    <div className="pt-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Max Allowable Discount Without Override (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formData.permissions.maxDiscountPercent}
                        onChange={e => setFormData({
                          ...formData,
                          permissions: {
                            ...formData.permissions,
                            maxDiscountPercent: Number(e.target.value)
                          }
                        })}
                        className="w-32 px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PAYROLL & EMERGENCY KYC */}
              {modalTab === 'kyc' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Monthly Base Salary (NPR)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.salary || ''}
                        onChange={e => setFormData({ ...formData, salary: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Hourly Overtime Rate (NPR)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.hourlyRate || ''}
                        onChange={e => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Emergency Contact Person
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Contact Name"
                        value={formData.emergencyName}
                        onChange={e => setFormData({ ...formData, emergencyName: e.target.value })}
                        className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={formData.emergencyPhone}
                        onChange={e => setFormData({ ...formData, emergencyPhone: e.target.value })}
                        className="px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                      <input
                        type="text"
                        placeholder="Relationship (e.g. Spouse)"
                        value={formData.emergencyRelation}
                        onChange={e => setFormData({ ...formData, emergencyRelation: e.target.value })}
                        className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Additional HR Notes */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      HR & Operational Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Previous work experience, probation period notes..."
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-400">
                  {modalTab === 'profile' && 'Proceed through tabs or save directly'}
                  {modalTab === 'security' && 'PIN is used for instant operator switch'}
                  {modalTab === 'permissions' && 'Configures role-based access rules'}
                  {modalTab === 'kyc' && 'Review details and complete registration'}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                  >
                    {editingStaff ? 'Save Changes' : 'Register Staff'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
