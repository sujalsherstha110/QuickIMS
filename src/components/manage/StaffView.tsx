import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, UserPlus, Phone, Mail, Clock, ShieldCheck, Shield,
  Search, Filter, CheckCircle2, Coffee, AlertCircle, Edit2, 
  Trash2, X, ChefHat, Wine, ShoppingCart, DollarSign,
  QrCode, KeyRound, Eye, EyeOff, ShieldAlert, Award,
  Sparkles, Layers, FileText, CheckSquare, Calendar, Sliders,
  Plus, Check, Send, RefreshCw, BadgeCheck, FileCheck, MapPin,
  Loader2, Info, Copy, ExternalLink, Link as LinkIcon
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
import { StaffPortalActivationModal } from '../auth/StaffPortalActivationModal';
import { StaffPermissionsMatrixEditor } from './StaffPermissionsMatrixEditor';
import { getPermissionsSummary, syncStaffPermissions, getDefaultStaffModulePermissions } from '../../utils/staffPermissionUtils';
import { Button } from '../common/Button';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const StaffView: React.FC = () => {
  const { 
    staffMembers, addStaffMember, updateStaffMember, deleteStaffMember, 
    diningTables, attendanceRecords, staffAuditLogs, 
    staffShifts, staffRoles, staffDepartments, staffStatuses,
    sendStaffVerificationEmail, checkStaffEmailVerification,
    verifyStaffEmailWithCode, markStaffEmailAsVerified,
    resetStaffData, canStaffDo, activeStaffUser
  } = useApp();

  const canAddStaff = canStaffDo('staffShifts', 'write');
  const canEditStaff = canStaffDo('staffShifts', 'update');
  const canDeleteStaff = canStaffDo('staffShifts', 'delete');
  
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [modalTab, setModalTab] = useState<'profile' | 'security' | 'permissions' | 'kyc'>('profile');
  const [showPin, setShowPin] = useState(false);
  const [showAlternatePhone, setShowAlternatePhone] = useState(false);

  // Email Verification & Activation Hub Modal State
  const [verificationHubStaff, setVerificationHubStaff] = useState<StaffMember | null>(null);
  const [hubCopied, setHubCopied] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [showResetStaffModal, setShowResetStaffModal] = useState(false);
  const [directActivationModalStaff, setDirectActivationModalStaff] = useState<StaffMember | null>(null);

  // Email Verification State
  const [verificationNotice, setVerificationNotice] = useState<{ text: string; type: 'success' | 'error' | 'info'; title?: string } | null>(null);
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');

  // Directory quick actions feedback
  const [quickVerifyLoadingId, setQuickVerifyLoadingId] = useState<string | null>(null);
  const [directoryNotice, setDirectoryNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Digital Badge Modal
  const [badgeStaff, setBadgeStaff] = useState<StaffMember | null>(null);
  const [createdStaffNotice, setCreatedStaffNotice] = useState<{ name: string; username: string; pin: string } | null>(null);

  // Granular Permissions Inspector Modal State
  const [inspectingPermissionsStaff, setInspectingPermissionsStaff] = useState<StaffMember | null>(null);

  // Custom Shift Schedule Mode inside Staff Modal
  const [isCustomShiftSchedule, setIsCustomShiftSchedule] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    username: string;
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
    username: '',
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
    const q = String(searchTerm || '').toLowerCase();
    return staffMembers.filter(member => {
      const matchSearch = 
        String(member.name || '').toLowerCase().includes(q) ||
        String(member.employeeCode || '').toLowerCase().includes(q) ||
        String(member.phone || '').includes(searchTerm) ||
        (member.alternatePhone && String(member.alternatePhone).includes(searchTerm)) ||
        (member.address && String(member.address).toLowerCase().includes(q)) ||
        (member.email && String(member.email).toLowerCase().includes(q)) ||
        (member.citizenshipOrPan && String(member.citizenshipOrPan).toLowerCase().includes(q));
      const matchRole = selectedRole === 'all' || String(member.role || '').toLowerCase() === String(selectedRole || '').toLowerCase();
      const matchDept = selectedDepartment === 'all' || (member.department && String(member.department).toLowerCase() === String(selectedDepartment || '').toLowerCase());
      const matchStatus = selectedStatus === 'all' || String(member.status || '').toLowerCase() === String(selectedStatus || '').toLowerCase();
      return matchSearch && matchRole && matchDept && matchStatus;
    });
  }, [staffMembers, searchTerm, selectedRole, selectedDepartment, selectedStatus]);

  // Track cooldown timer for active email to prevent Firebase auth/too-many-requests
  useEffect(() => {
    if (!formData.email) {
      setResendCooldown(0);
      return;
    }
    const cleanEmail = formData.email.trim().toLowerCase();
    const key = `quickims_staff_resend_${cleanEmail}`;

    const checkCooldown = () => {
      const storedExpiry = localStorage.getItem(key);
      if (storedExpiry) {
        const remaining = Math.max(0, Math.ceil((parseInt(storedExpiry, 10) - Date.now()) / 1000));
        setResendCooldown(remaining);
        if (remaining <= 0) {
          localStorage.removeItem(key);
        }
      } else {
        setResendCooldown(0);
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [formData.email]);

  const triggerCooldown = (seconds: number) => {
    if (!formData.email) return;
    const cleanEmail = formData.email.trim().toLowerCase();
    const key = `quickims_staff_resend_${cleanEmail}`;
    const expiry = Date.now() + seconds * 1000;
    localStorage.setItem(key, expiry.toString());
    setResendCooldown(seconds);
  };

  // Window focus auto-check: when manager/staff opens another tab to click verification email
  // and then returns to this window, automatically check verification status!
  useEffect(() => {
    const handleFocus = async () => {
      if (isModalOpen && formData.email && !formData.emailVerified) {
        try {
          const res = await checkStaffEmailVerification(formData.email, editingStaff?.id);
          if (res.verified) {
            setFormData(prev => ({ ...prev, emailVerified: true }));
            setVerificationNotice({
              type: 'success',
              title: 'Email Verified via Link',
              text: `Success! ${formData.email} was verified via the confirmation link.`
            });
          }
        } catch {
          // Ignore focus check errors
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isModalOpen, formData.email, formData.emailVerified, editingStaff, checkStaffEmailVerification]);

  // Directory notice auto-dismiss after 5s
  useEffect(() => {
    if (!directoryNotice) return;
    const t = setTimeout(() => setDirectoryNotice(null), 5000);
    return () => clearTimeout(t);
  }, [directoryNotice]);

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
    setShowCodeInput(false);
    setIsSendingEmail(false);
    setIsCheckingStatus(false);
    setIsVerifyingCode(false);
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
      username: '',
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
    setShowCodeInput(false);
    setIsSendingEmail(false);
    setIsCheckingStatus(false);
    setIsVerifyingCode(false);
    setEnteredOtp('');

    const matchedShift = staffShifts.find(s => s.id === staff.shiftId || s.name === staff.shift);
    setIsCustomShiftSchedule(!matchedShift && !!staff.shiftStartTime);

    setFormData({
      name: staff.name,
      username: staff.username || '',
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
      permissions: staff.permissions 
        ? syncStaffPermissions(staff.permissions, staff.permissions.modules || getDefaultStaffModulePermissions(staff.role))
        : getDefaultStaffPermissions(staff.role),
      avatarColor: staff.avatarColor || '#2563eb',
      notes: staff.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleRoleChange = (newRole: string) => {
    let dept = formData.department;
    const roleDef = staffRoles.find(r => String(r.name || '').toLowerCase() === String(newRole || '').toLowerCase());
    if (roleDef && roleDef.departmentDefault) {
      dept = roleDef.departmentDefault;
    } else {
      const lower = String(newRole || '').toLowerCase();
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

  // Email Verification Handlers (Real Firebase Auth Delivery & Status Verification)
  const handleVerifyEmail = async () => {
    if (!formData.email || !formData.email.includes('@')) {
      setVerificationNotice({ text: 'Please enter a valid email address first.', type: 'error' });
      return;
    }

    // If email already sent and within cooldown or already dispatched, check verification status first!
    if (verificationCodeSent) {
      setIsCheckingStatus(true);
      setVerificationNotice(null);
      try {
        const checkRes = await checkStaffEmailVerification(formData.email, editingStaff?.id);
        if (checkRes.verified) {
          setFormData(prev => ({ ...prev, emailVerified: true }));
          setVerificationNotice({
            type: 'success',
            title: 'Email Verified Successfully',
            text: `Success! ${formData.email} has been verified and confirmed through Firebase Auth.`
          });
          setIsCheckingStatus(false);
          return;
        }
      } catch {
        // Proceed
      } finally {
        setIsCheckingStatus(false);
      }

      if (resendCooldown > 0) {
        setVerificationNotice({
          type: 'info',
          title: 'Verification Link Pending',
          text: `A verification link has already been sent to ${formData.email}. Please open the email in your inbox and click the confirmation link. You can request another email in ${resendCooldown}s.`
        });
        return;
      }
    }

    // Send real verification email via Firebase
    setIsSendingEmail(true);
    setVerificationNotice(null);
    try {
      await sendStaffVerificationEmail(formData.email, formData.name);
      triggerCooldown(60);
      setVerificationCodeSent(true);
      setVerificationNotice({
        type: 'success',
        title: 'Verification Email Dispatched',
        text: `A genuine verification link has been sent to ${formData.email}. Please check your Gmail Inbox, Spam, and Promotions folders, click the confirmation link, and return here.`
      });
    } catch (err: any) {
      const isRateLimit = 
        err.code === 'auth/too-many-requests' || 
        err.message?.includes('too-many-requests') ||
        err.message?.includes('TOO_MANY_ATTEMPTS_TRY_LATER');

      if (isRateLimit) {
        triggerCooldown(120);
        setVerificationNotice({
          type: 'error',
          title: 'Firebase Rate Limit Reached',
          text: 'Firebase temporarily paused new requests. An email was already sent. Please wait 2 minutes before requesting another.'
        });
      } else {
        setVerificationNotice({
          type: 'error',
          title: 'Delivery Notice',
          text: err.message || 'Failed to dispatch verification email. Please check your connection.'
        });
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    if (!formData.email || !formData.email.includes('@')) {
      setVerificationNotice({ text: 'Please enter a valid email address first.', type: 'error' });
      return;
    }
    if (resendCooldown > 0 || isSendingEmail) return;

    setIsSendingEmail(true);
    setVerificationNotice(null);
    try {
      const res = await sendStaffVerificationEmail(formData.email, formData.name);
      triggerCooldown(60); // 60s cooldown to prevent Firebase auth/too-many-requests
      setVerificationCodeSent(true);
      setVerificationNotice({
        type: 'success',
        title: 'Real Verification Email Dispatched',
        text: `A genuine verification link has been sent to ${formData.email}. Please ask the staff member to check their Gmail Inbox, Spam, and Promotions folders, click the confirmation link, and then return here.`
      });
    } catch (err: any) {
      const isRateLimit = 
        err.code === 'auth/too-many-requests' || 
        err.message?.includes('too-many-requests') ||
        err.message?.includes('TOO_MANY_ATTEMPTS_TRY_LATER');

      if (isRateLimit) {
        triggerCooldown(120);
        setVerificationNotice({
          type: 'error',
          title: 'Firebase Rate Limit Reached',
          text: 'Firebase temporarily paused new email requests because multiple attempts were triggered in a short time. An email is already on its way. Please wait 2 minutes before requesting another link.'
        });
      } else {
        setVerificationNotice({
          type: 'error',
          title: 'Delivery Notice',
          text: err.message || 'Failed to dispatch verification email. Please check internet connection.'
        });
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!formData.email) return;
    setIsCheckingStatus(true);
    setVerificationNotice(null);
    try {
      const res = await checkStaffEmailVerification(formData.email, editingStaff?.id);
      if (res.verified) {
        setFormData(prev => ({ ...prev, emailVerified: true }));
        setVerificationNotice({
          type: 'success',
          title: 'Email Verified Successfully',
          text: `Success! ${formData.email} has been verified and confirmed through Firebase Auth.`
        });
      } else {
        setVerificationNotice({
          type: 'info',
          title: 'Verification Link Pending',
          text: res.message || 'The email link has not been clicked yet. Please open the confirmation email, click the link, and check again.'
        });
      }
    } catch (err: any) {
      setVerificationNotice({
        type: 'error',
        title: 'Check Error',
        text: err.message || 'Unable to check verification status. Please try again.'
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleConfirmVerificationCode = async () => {
    if (!enteredOtp || enteredOtp.trim().length !== 6) {
      setVerificationNotice({ text: 'Please enter the 6-digit confirmation code.', type: 'error' });
      return;
    }
    setIsVerifyingCode(true);
    try {
      const res = await verifyStaffEmailWithCode(formData.email, enteredOtp, editingStaff?.id);
      if (res.success) {
        setFormData(prev => ({ ...prev, emailVerified: true }));
        setEnteredOtp('');
        setShowCodeInput(false);
        setVerificationNotice({
          type: 'success',
          title: 'Code Verified',
          text: res.message || `Email ${formData.email} verified successfully!`
        });
      } else {
        setVerificationNotice({
          type: 'error',
          title: 'Incorrect Code',
          text: res.message || 'Incorrect 6-digit code. Please verify and try again.'
        });
      }
    } catch (err: any) {
      setVerificationNotice({
        type: 'error',
        text: err.message || 'Verification failed. Please try again.'
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleInstantVerify = async () => {
    if (!formData.email || !formData.email.includes('@')) {
      setVerificationNotice({ text: 'Please enter a valid email address first.', type: 'error' });
      return;
    }
    if (editingStaff?.id) {
      await markStaffEmailAsVerified(editingStaff.id);
    }
    setFormData(prev => ({ ...prev, emailVerified: true }));
    setVerificationNotice({
      type: 'success',
      title: 'Manager Override',
      text: `Staff email ${formData.email} marked as verified by Manager.`
    });
  };

  const handleRevokeVerification = () => {
    setFormData(prev => ({ ...prev, emailVerified: false }));
    setVerificationNotice({
      type: 'info',
      text: 'Email verification status reset to unverified.'
    });
  };

  // Open verification hub modal for a staff member
  const openVerificationHub = async (staff: StaffMember) => {
    setVerificationHubStaff(staff);
    setHubCopied(false);
    if (staff.email) {
      try {
        const checkRes = await checkStaffEmailVerification(staff.email, staff.id);
        if (checkRes.verified) {
          setVerificationHubStaff(prev => prev && prev.id === staff.id ? { ...prev, emailVerified: true } : prev);
        }
      } catch (err) {
        console.warn('Check email verification notice:', err);
      }
    }
  };

  const handleCopyActivationLink = (staff: StaffMember) => {
    const token = staff.verificationToken || `token_${Date.now()}`;
    const url = `${window.location.origin}${window.location.pathname}?verifyStaff=true&email=${encodeURIComponent(staff.email || '')}&token=${token}&staffId=${staff.id}`;
    navigator.clipboard.writeText(url);
    setHubCopied(true);
    setDirectoryNotice({
      type: 'success',
      text: `One-time activation link copied for ${staff.name}!`
    });
    setTimeout(() => setHubCopied(false), 3000);
  };

  // Quick Directory Email Verification: opens the verification & activation hub
  const handleQuickVerifyEmail = async (staff: StaffMember) => {
    openVerificationHub(staff);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.name.trim() || !formData.phone.trim() || !formData.role.trim()) return;

    setIsSubmitting(true);
    try {
      // Filter valid documents
      const validDocuments = formData.documents.filter(d => d.documentNumber.trim());

      const payload = {
        name: formData.name.trim(),
        username: formData.username.trim() || (formData.name ? String(formData.name).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15) : undefined),
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
        setIsModalOpen(false);
      } else {
        const saved = await addStaffMember(payload);
        setIsModalOpen(false);
        setCreatedStaffNotice({
          name: saved.name,
          username: saved.username || saved.employeeCode,
          pin: saved.pin
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (staff: StaffMember) => {
    if (!canEditStaff) return;
    const nextStatus = staff.status === 'active' ? 'on_break' : staff.status === 'on_break' ? 'off_duty' : 'active';
    await updateStaffMember(staff.id, { status: nextStatus });
  };

  const openOrgManager = (tab: 'roles' | 'departments' | 'shifts' | 'statuses') => {
    if (!canAddStaff && !canEditStaff) return;
    setOrgModalInitialTab(tab);
    setIsOrgModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
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
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {!activeStaffUser && (
            <Button
              variant="amber"
              size="sm"
              onClick={() => setShowResetStaffModal(true)}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Reset Staff Data
            </Button>
          )}

          {(canAddStaff || canEditStaff) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openOrgManager('roles')}
              icon={<Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
            >
              Manage Master Data
            </Button>
          )}

          {canAddStaff && (
            <Button
              variant="primary-arrow"
              size="sm"
              onClick={handleOpenAdd}
            >
              Add Staff Member
            </Button>
          )}
        </div>
      </div>

      {/* Staff Account Credentials Banner */}
      {createdStaffNotice && (
        <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-start justify-between gap-3 animate-in fade-in shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Staff Account Registered & Ready for Device Login
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                <strong>{createdStaffNotice.name}</strong> can now log in on any tablet, phone, POS, or KDS display.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <span className="bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 font-mono">
                  Username: <strong className="text-indigo-600 dark:text-indigo-400">{createdStaffNotice.username}</strong>
                </span>
                <span className="bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 font-mono">
                  4-Digit PIN: <strong className="text-indigo-600 dark:text-indigo-400">{createdStaffNotice.pin}</strong>
                </span>
                <span className="text-2xs text-emerald-700 dark:text-emerald-400 font-medium">
                  • Automatic connection to this restaurant
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreatedStaffNotice(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-emerald-100 dark:hover:bg-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUB-NAVIGATION TABS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'directory', label: `Staff Directory (${staffMembers.length})`, icon: Users },
          { id: 'attendance', label: 'Daily Attendance & QR Kiosk', icon: QrCode },
          { id: 'shifts', label: 'Shifts & Rostering', icon: Calendar },
          { id: 'audit_trail', label: `Staff Audit Logs (${staffAuditLogs.length})`, icon: ShieldAlert },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeMainTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-white/20 inset'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
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
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
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
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
              >
                <option value="all">All Roles</option>
                {allRolesList.map(r => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>

              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Departments</option>
                {allDeptsList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
              >
                <option value="all">All Statuses</option>
                {allStatusesList.map(st => (
                  <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Directory Notice Banner */}
          {directoryNotice && (
            <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150 ${
              directoryNotice.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                : directoryNotice.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>{directoryNotice.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setDirectoryNotice(null)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Staff Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredStaff.map(staff => {
              const permissions = staff.permissions || getDefaultStaffPermissions(staff.role);
              const matchedShift = staffShifts.find(s => s.id === staff.shiftId || s.name === staff.shift);

              return (
                <div 
                  key={staff.id} 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-600 transition-all group"
                >
                  <div>
                    {/* Card Top: Avatar, Name, Role, Employee Code */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm group-hover:scale-105 transition-transform"
                          style={{ backgroundColor: staff.avatarColor || '#2563eb' }}
                        >
                          {staff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">{staff.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                              {staff.employeeCode}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              @{staff.username || String(staff.employeeCode || '').toLowerCase()}
                            </span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-300 capitalize font-bold">
                              {String(staff.role || '').replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canEditStaff}
                        onClick={() => handleToggleStatus(staff)}
                        title={canEditStaff ? 'Click to toggle status' : 'Status update restricted'}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider transition-colors ${canEditStaff ? 'cursor-pointer' : 'cursor-default opacity-80'} ${
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
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[170px] font-mono text-[11px]">{staff.email}</span>
                            {staff.emailVerified ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.2 rounded-full">
                                <BadgeCheck className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Verified</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-1.5 py-0.2 rounded-full">
                                <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                <span>Pending</span>
                              </span>
                            )}
                          </div>
                          {!staff.emailVerified && canEditStaff && (
                            <div className="pl-5 pt-0.5 flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openVerificationHub(staff)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                                title="Click to open verification hub & copy link"
                              >
                                <ShieldCheck className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                                <span>Verify Email</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyActivationLink(staff)}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                title="Copy portal activation link"
                              >
                                <Copy className="w-2.5 h-2.5" />
                                <span>Copy Link</span>
                              </button>
                            </div>
                          )}
                          {staff.emailVerified && (
                            <div className="pl-5 pt-0.5">
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Portal Ready (Username & PIN)</span>
                              </span>
                            </div>
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
                          <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
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

                    {/* Granular CRUD Permissions summary on card */}
                    {(() => {
                      const summary = getPermissionsSummary(permissions);
                      return (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            {summary.isFullAccess ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Full CRUD Access</span>
                              </span>
                            ) : (
                              <>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title="Read permission count">
                                  R:{summary.totalRead}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800" title="Write permission count">
                                  W:{summary.totalWrite}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title="Update permission count">
                                  U:{summary.totalUpdate}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800" title="Delete permission count">
                                  D:{summary.totalDelete}
                                </span>
                              </>
                            )}
                            {permissions.requirePinPerAction && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                title="Requires 4-digit PIN on every POS action (Fire Order, Settle Bill, etc.)"
                              >
                                <KeyRound className="w-2.5 h-2.5" />
                                <span>PIN/Action</span>
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setInspectingPermissionsStaff(staff)}
                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer ml-auto"
                            title="Inspect & Edit Granular Permissions"
                          >
                            <Shield className="w-3 h-3" />
                            <span>Permissions</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setBadgeStaff(staff)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/60 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>ID Badge</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {canEditStaff && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(staff)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDeleteStaff && (
                        <button
                          type="button"
                          onClick={() => setStaffToDelete(staff)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Delete Staff"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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

      {/* PROPORTIONATE & WELL-SIZED ADD / EDIT STAFF MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
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
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
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
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
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
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
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
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
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
                  
                  {/* Row 1: Full Name, Portal Username & Employee Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Staff Full Name"
                        value={formData.name}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            name: val,
                            username: prev.username || String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15)
                          }));
                        }}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Portal Username
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const generated = (formData.name ? String(formData.name).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15) : `user_${staffMembers.length + 101}`);
                            setFormData({ ...formData, username: generated });
                          }}
                          className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                        >
                          Auto Generate
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">@</span>
                        <input
                          type="text"
                          placeholder="e.g. staff_portal_id"
                          value={formData.username}
                          onChange={e => setFormData({ ...formData, username: String(e.target.value || '').toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                          className="w-full pl-7 pr-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Employee Code
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, employeeCode: `EMP-${staffMembers.length + 101}` })}
                          className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                        >
                          Auto Generate
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. EMP-101"
                        value={formData.employeeCode}
                        onChange={e => setFormData({ ...formData, employeeCode: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                            Age: {calculatedAge} years
                          </span>
                        )}
                      </div>
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={e => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
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
                        className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      {showAlternatePhone && (
                        <div className="mt-2 flex items-center gap-1.5 animate-in fade-in duration-150">
                          <input
                            type="tel"
                            placeholder="Alternate phone number"
                            value={formData.alternatePhone}
                            onChange={e => setFormData({ ...formData, alternatePhone: e.target.value })}
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Row 4: Email Address & Change Email Option */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-blue-600" />
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
                              <BadgeCheck className="w-3 h-3 text-emerald-600" />
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
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />

                    {formData.email && (
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                        {formData.emailVerified ? (
                          /* Verified State Banner */
                          <div className="p-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                                <BadgeCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Email Verified</span>
                                  <span className="text-[10px] bg-emerald-200/80 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold px-1.5 py-0.2 rounded">Firebase Auth</span>
                                </div>
                                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                                  {formData.email}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Pending Verification Card with Real Actions */
                          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-amber-950 dark:text-amber-200">Email Verification Required</span>
                                  <p className="text-[11px] text-amber-800/80 dark:text-amber-400">
                                    Dispatch a genuine verification link directly to the staff member's inbox to confirm identity.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Notice / Feedback Banner */}
                            {verificationNotice && (
                              <div className={`p-2.5 rounded-xl text-xs font-medium flex items-start gap-2 ${
                                verificationNotice.type === 'success'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                                  : verificationNotice.type === 'error'
                                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                                  : 'bg-blue-100 dark:bg-blue-950/80 text-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800'
                              }`}>
                                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                                <div className="space-y-0.5">
                                  {verificationNotice.title && (
                                    <div className="font-bold text-xs">{verificationNotice.title}</div>
                                  )}
                                  <p className="text-[11px] leading-relaxed">{verificationNotice.text}</p>
                                </div>
                              </div>
                            )}

                            {/* Single Clean Action: Verify Email */}
                            <div className="flex items-center gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={handleVerifyEmail}
                                disabled={isSendingEmail || isCheckingStatus}
                                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                                  resendCooldown > 0
                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 hover:scale-[1.01]'
                                }`}
                              >
                                {isSendingEmail ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Sending Verification Email...</span>
                                  </>
                                ) : isCheckingStatus ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Checking Status...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{resendCooldown > 0 ? `Verify Email (Resend in ${resendCooldown}s)` : 'Verify Email'}</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Helpful Tips */}
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 pt-1">
                              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                              <span>
                                The verification link is delivered directly by Firebase Authentication to the staff member's email inbox. Ask them to check Spam/Promotions if not found immediately.
                              </span>
                            </div>
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
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          <span>Role / Designation *</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => openOrgManager('roles')}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Sliders className="w-2.5 h-2.5" />
                          <span>Manage</span>
                        </button>
                      </div>

                      <select
                        value={formData.role}
                        onChange={e => handleRoleChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {staffRoles.map(r => (
                          <option key={r.id} value={r.name}>{r.name.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>Department / Area</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => openOrgManager('departments')}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Sliders className="w-2.5 h-2.5" />
                          <span>Manage</span>
                        </button>
                      </div>

                      <select
                        value={formData.department}
                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Assigned Shift Timetable (Datetime-Based)</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCustomShiftSchedule(!isCustomShiftSchedule)}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
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
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {staffShifts.map(sh => (
                            <option key={sh.id} value={sh.id}>
                              {sh.name} ({sh.startTime} – {sh.endTime})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2">
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
                                      ? 'bg-blue-600 text-white'
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
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Floor / Duty Status</span>
                      </label>
                      <span className="text-[11px] text-slate-500">Current availability on dining floor</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          <FileCheck className="w-4 h-4 text-blue-600" />
                          <span>Identification Documents (PAN, NID, Citizenship, etc.)</span>
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Add multiple verification documents with category & document number
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddDocumentRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
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
                          className="mt-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
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
                          className="w-full py-1.5 border border-dashed border-blue-300 dark:border-blue-700 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                  <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2.5">
                      <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
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
                          className="w-full px-3.5 py-2 text-base font-mono font-black tracking-widest rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                  {/* Staff Portal Sign In Preview */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Staff Portal Direct Credentials
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 block font-semibold">Portal Username</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          @{formData.username || (formData.name ? String(formData.name).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15) : 'username')}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 block font-semibold">4-Digit PIN</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 tracking-widest">
                          {formData.pin ? formData.pin : '••••'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Staff members enter this username and 4-digit PIN to directly access their POS terminal and assigned tools without typing emails or passwords.
                    </p>
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

              {/* TAB 3: PERMISSIONS (RBAC & CRUD MATRIX) */}
              {modalTab === 'permissions' && (
                <div className="space-y-4">
                  <StaffPermissionsMatrixEditor
                    permissions={formData.permissions}
                    currentRole={formData.role}
                    onChange={updated => setFormData({ ...formData, permissions: updated })}
                  />
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
                  <Button
                    variant="secondary"
                    size="md"
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    type="submit"
                    loading={isSubmitting}
                  >
                    {editingStaff ? 'Save Changes' : 'Register Staff'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-slate-800 dark:text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Remove Staff Member?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to remove <strong>{staffToDelete.name}</strong> ({staffToDelete.employeeCode})? This will delete the duplicate profile from your staff directory.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                type="button"
                onClick={() => setStaffToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                fullWidth
                type="button"
                onClick={async () => {
                  const name = staffToDelete.name;
                  const code = staffToDelete.employeeCode;
                  await deleteStaffMember(staffToDelete.id);
                  setStaffToDelete(null);
                  setDirectoryNotice({
                    type: 'success',
                    text: `Removed ${name} (${code}) successfully.`
                  });
                }}
              >
                Remove Staff
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RESET STAFF PROFILES CONFIRMATION MODAL */}
      {showResetStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-slate-800 dark:text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Reset Staff Directory?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Reset staff list to default roles (Waiter, Cashier, Chef, Bartender, Manager) with clean permissions?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                type="button"
                onClick={() => setShowResetStaffModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="amber"
                size="md"
                fullWidth
                type="button"
                onClick={async () => {
                  setShowResetStaffModal(false);
                  await resetStaffData();
                  setDirectoryNotice({ type: 'success', text: 'Staff profiles and permission grants have been successfully reset to default!' });
                }}
              >
                Reset Staff
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STAFF PORTAL VERIFICATION & ACTIVATION HUB MODAL */}
      {verificationHubStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-800 dark:text-slate-100 my-8">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-5 text-white flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Staff Verification & Portal Link</h3>
                  <p className="text-xs text-blue-100 mt-0.5">Quick IMS Access for {verificationHubStaff.name}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setVerificationHubStaff(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Profile Bar */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{verificationHubStaff.name}</span>
                    <span className="font-mono text-2xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                      {verificationHubStaff.employeeCode}
                    </span>
                    <span className="font-mono text-2xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                      @{verificationHubStaff.username || String(verificationHubStaff.employeeCode || '').toLowerCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    {verificationHubStaff.email}
                  </p>
                </div>

                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                  verificationHubStaff.emailVerified
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                }`}>
                  {verificationHubStaff.emailVerified ? (
                    <>
                      <BadgeCheck className="w-3.5 h-3.5" />
                      <span>Verified</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Pending Verification</span>
                    </>
                  )}
                </span>
              </div>

              {/* Informative Explanation of External Email vs Direct Link */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-1 text-xs">
                <div className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Why emails may be delayed & How to activate instantly:</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] pt-1">
                  Google and mail providers often filter automated Firebase emails or place them in Promotions/Spam. 
                  You don't need to wait! Use any of the fast actions below to activate and sign in immediately:
                </p>
              </div>

              {/* Action 1: Direct Activation Link Copy */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Direct One-Time Activation Link</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold">Fastest onboarding</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}${window.location.pathname}?verifyStaff=true&email=${encodeURIComponent(verificationHubStaff.email || '')}&token=${verificationHubStaff.verificationToken || 'token'}&staffId=${verificationHubStaff.id}`}
                    className="w-full px-3 py-2 text-2xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 truncate focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyActivationLink(verificationHubStaff)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                      hubCopied 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                    }`}
                  >
                    {hubCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Send this link to the staff member via WhatsApp, Viber, SMS, or Slack. When clicked, it activates their portal.
                </p>
              </div>

              {/* Action 2: Open Activation Screen Right Now */}
              <div className="p-3.5 rounded-2xl bg-blue-600 text-white space-y-2 shadow-md shadow-blue-600/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                    Instant Setup On This Device
                  </span>
                  <KeyRound className="w-4 h-4 text-blue-200" />
                </div>
                <p className="text-xs text-blue-100 leading-relaxed">
                  Open the activation screen right now to set the 4-digit PIN and immediately confirm access.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const target = verificationHubStaff;
                    setVerificationHubStaff(null);
                    setDirectActivationModalStaff(target);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Staff Portal Activation Screen</span>
                </button>
              </div>

              {/* Action 3: Manager Instant Verification (1-Click) */}
              {!verificationHubStaff.emailVerified && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 block">
                      Manager Instant Verification
                    </span>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
                      Bypasses email delivery and immediately activates staff login with Username & PIN.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await markStaffEmailAsVerified(verificationHubStaff.id);
                      setVerificationHubStaff(prev => prev ? { ...prev, emailVerified: true } : null);
                      setDirectoryNotice({
                        type: 'success',
                        text: `Staff member ${verificationHubStaff.name} marked as Verified!`
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition-colors shadow-xs cursor-pointer"
                  >
                    Verify Instantly
                  </button>
                </div>
              )}

              {/* Action 4: Resend Email */}
              <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Confirmation Code: <strong className="font-mono text-slate-800 dark:text-slate-200">{verificationHubStaff.verificationCode || '123456'}</strong></span>
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={async () => {
                    if (!verificationHubStaff.email) return;
                    setIsSendingEmail(true);
                    try {
                      const res = await sendStaffVerificationEmail(verificationHubStaff.email, verificationHubStaff.name, verificationHubStaff.id);
                      if (res.alreadyVerified) {
                        setVerificationHubStaff(prev => prev ? { ...prev, emailVerified: true } : null);
                        setDirectoryNotice({
                          type: 'success',
                          text: `Email ${verificationHubStaff.email} confirmed via Google OAuth!`
                        });
                      } else {
                        setDirectoryNotice({
                          type: 'success',
                          text: `Verification email triggered for ${verificationHubStaff.email}. Check spam/inbox or use the copy link above.`
                        });
                      }
                    } catch (err: any) {
                      setDirectoryNotice({
                        type: 'error',
                        text: err.message || 'Unable to dispatch email.'
                      });
                    } finally {
                      setIsSendingEmail(false);
                    }
                  }}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Resend Email</span>
                </button>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setVerificationHubStaff(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close Hub
              </button>
            </div>

          </div>
        </div>
      )}

      {/* INSPECT & DIRECT EDIT PERMISSIONS MODAL */}
      {inspectingPermissionsStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-xs"
                  style={{ backgroundColor: inspectingPermissionsStaff.avatarColor || '#2563eb' }}
                >
                  {inspectingPermissionsStaff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{inspectingPermissionsStaff.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                      {inspectingPermissionsStaff.role.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                      ({inspectingPermissionsStaff.employeeCode})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Granular CRUD Permission Levels (Read, Write, Update, Delete)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingPermissionsStaff(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <StaffPermissionsMatrixEditor
                permissions={inspectingPermissionsStaff.permissions || getDefaultStaffPermissions(inspectingPermissionsStaff.role)}
                currentRole={inspectingPermissionsStaff.role}
                readOnly={!canEditStaff}
                onChange={async updated => {
                  if (!canEditStaff) return;
                  setInspectingPermissionsStaff({
                    ...inspectingPermissionsStaff,
                    permissions: updated
                  });
                  await updateStaffMember(inspectingPermissionsStaff.id, {
                    permissions: updated
                  });
                }}
              />
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Permissions are automatically synchronized and updated in real-time.</span>
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setInspectingPermissionsStaff(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT PORTAL ACTIVATION MODAL */}
      {directActivationModalStaff && (
        <StaffPortalActivationModal
          email={directActivationModalStaff.email || ''}
          token={directActivationModalStaff.verificationToken || 'token'}
          staffId={directActivationModalStaff.id}
          onClose={() => setDirectActivationModalStaff(null)}
        />
      )}

      {/* MASTER DATA MANAGEMENT MODAL (Rendered in front with z-[70]) */}
      <StaffOrgManagerModal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        initialTab={orgModalInitialTab}
      />
    </div>
  );
};
