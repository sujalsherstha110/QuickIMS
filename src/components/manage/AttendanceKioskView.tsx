import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, Clock, CheckCircle2, Coffee, LogOut, LogIn, 
  RotateCcw, Sparkles, AlertCircle, Search, Filter, ShieldCheck,
  Calendar, UserCheck, Smartphone, Hash, ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StaffMember, AttendanceRecord } from '../../types';

export const AttendanceKioskView: React.FC = () => {
  const { 
    staffMembers, attendanceRecords, clockInStaff, clockOutStaff, 
    startStaffBreak, endStaffBreak, getTodayAttendanceToken
  } = useApp();

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [dailyQrDataUrl, setDailyQrDataUrl] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [selectedStaffForAction, setSelectedStaffForAction] = useState<StaffMember | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Live Clock (1 second interval)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate Daily QR Code
  useEffect(() => {
    const token = getTodayAttendanceToken();
    QRCode.toDataURL(token, {
      width: 260,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setDailyQrDataUrl(url))
      .catch(err => console.error('Error generating daily kiosk QR', err));
  }, [getTodayAttendanceToken]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Today's attendance records
  const todayRecords = useMemo(() => {
    return attendanceRecords.filter(r => r.date === todayStr);
  }, [attendanceRecords, todayStr]);

  // Match staff by PIN input
  useEffect(() => {
    if (pinInput.length === 4) {
      const matched = staffMembers.find(s => s.pin === pinInput.trim());
      if (matched) {
        setSelectedStaffForAction(matched);
        setFeedbackMessage({
          text: `Identified: ${matched.name} (${matched.role.replace(/_/g, ' ').toUpperCase()})`,
          type: 'info'
        });
      } else {
        setSelectedStaffForAction(null);
        setFeedbackMessage({
          text: 'No staff found with this 4-digit PIN.',
          type: 'error'
        });
        setTimeout(() => setFeedbackMessage(null), 3000);
      }
    } else if (pinInput.length < 4) {
      if (selectedStaffForAction && pinInput.length === 0) {
        setSelectedStaffForAction(null);
      }
    }
  }, [pinInput, staffMembers]);

  const handleNumpadPress = (num: string) => {
    if (pinInput.length < 4) {
      setPinInput(prev => prev + num);
    }
  };

  const handleClearPin = () => {
    setPinInput('');
    setSelectedStaffForAction(null);
    setFeedbackMessage(null);
  };

  // Staff action handlers
  const handleExecuteClockIn = async (staffId: string, method: 'pin' | 'qr_kiosk' | 'badge_scan' | 'manual' = 'pin') => {
    const res = await clockInStaff(staffId, method);
    if (res.success) {
      setFeedbackMessage({ text: res.message, type: 'success' });
      handleClearPin();
    } else {
      setFeedbackMessage({ text: res.message, type: 'error' });
    }
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleExecuteClockOut = async (staffId: string) => {
    const res = await clockOutStaff(staffId);
    if (res.success) {
      setFeedbackMessage({ text: res.message, type: 'success' });
      handleClearPin();
    } else {
      setFeedbackMessage({ text: res.message, type: 'error' });
    }
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleExecuteBreakStart = async (staffId: string) => {
    const res = await startStaffBreak(staffId);
    if (res.success) {
      setFeedbackMessage({ text: res.message, type: 'success' });
      handleClearPin();
    } else {
      setFeedbackMessage({ text: res.message, type: 'error' });
    }
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleExecuteBreakEnd = async (staffId: string) => {
    const res = await endStaffBreak(staffId);
    if (res.success) {
      setFeedbackMessage({ text: res.message, type: 'success' });
      handleClearPin();
    } else {
      setFeedbackMessage({ text: res.message, type: 'error' });
    }
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Get active session for a staff member today
  const getStaffTodayRecord = (staffId: string) => {
    return todayRecords.find(r => r.staffId === staffId && r.status !== 'completed') || 
           todayRecords.find(r => r.staffId === staffId);
  };

  const filteredStaffList = useMemo(() => {
    const q = String(searchQuery || '').toLowerCase().trim();
    return staffMembers.filter(s => 
      String(s.name || '').toLowerCase().includes(q) ||
      String(s.employeeCode || '').toLowerCase().includes(q) ||
      String(s.role || '').toLowerCase().includes(q)
    );
  }, [staffMembers, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Live Clock & Kiosk Headline */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-blue-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Terminal Kiosk Active
              </span>
              <span className="text-xs text-blue-300 font-mono">STATION #01</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Daily Attendance & Clock-In Hub</h1>
            <p className="text-sm text-blue-200/80 max-w-xl mt-1">
              Staff can scan today&apos;s dynamic QR code with their mobile device, scan their badge, or punch in using their 4-digit PIN.
            </p>
          </div>

          {/* Large Live Digital Clock */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 px-6 py-4 rounded-2xl flex items-center gap-5 shadow-inner">
            <div className="p-3 bg-blue-600/60 rounded-xl text-blue-200">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-mono font-black tracking-wider text-white">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </div>
              <div className="text-xs text-blue-200 font-medium">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Kiosk Grid (Daily QR Code on Left, Fast 4-Digit Numpad on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dynamic QR Code Kiosk Screen */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center">
          <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
            <div className="flex items-center gap-2 text-left">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Dynamic Station QR</h3>
                <p className="text-xs text-slate-500">Auto-refreshed daily token</p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              {todayStr}
            </span>
          </div>

          {/* QR Display Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-inner flex flex-col items-center">
            {dailyQrDataUrl ? (
              <img 
                src={dailyQrDataUrl} 
                alt="Daily Attendance Station QR" 
                className="w-56 h-56 rounded-2xl bg-white p-2 shadow-sm"
              />
            ) : (
              <div className="w-56 h-56 rounded-2xl bg-white flex items-center justify-center text-slate-400 font-mono text-xs">
                Generating QR...
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Scan with mobile to clock in/out instantly</span>
            </div>
          </div>

          <div className="mt-6 w-full p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-left">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">Secure Contactless Attendance</p>
                <p>Staff scanning this dynamic QR code will be prompted for their 4-digit PIN on their phone to verify attendance.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Fast 4-Digit PIN Punch Terminal */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Quick PIN Clock-In Terminal</h3>
                <p className="text-xs text-slate-500">Walk up & type your 4-digit PIN code</p>
              </div>
            </div>
            {pinInput.length > 0 && (
              <button
                onClick={handleClearPin}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Feedback Banner */}
          {feedbackMessage && (
            <div className={`mb-4 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
              feedbackMessage.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                : feedbackMessage.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}>
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* PIN Input Display */}
          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60 mb-5 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
              Enter 4-Digit Employee PIN
            </span>
            <div className="flex items-center gap-3">
              {[0, 1, 2, 3].map(idx => {
                const isFilled = pinInput.length > idx;
                return (
                  <div 
                    key={idx}
                    className={`w-12 h-14 rounded-2xl flex items-center justify-center font-mono text-xl font-black border-2 transition-all ${
                      isFilled 
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 scale-105 shadow-sm'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-300'
                    }`}
                  >
                    {isFilled ? '●' : '—'}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Area when Staff is Recognized */}
          {selectedStaffForAction ? (
            <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-5 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                    style={{ backgroundColor: selectedStaffForAction.avatarColor || '#2563eb' }}
                  >
                    {selectedStaffForAction.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{selectedStaffForAction.name}</h4>
                    <p className="text-xs text-slate-500">
                      {selectedStaffForAction.employeeCode} • <span className="uppercase">{selectedStaffForAction.role.replace(/_/g, ' ')}</span>
                    </p>
                  </div>
                </div>

                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase ${
                  selectedStaffForAction.status === 'active'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : selectedStaffForAction.status === 'on_break'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  Current: {selectedStaffForAction.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Dynamic Action Buttons based on status */}
              {(() => {
                const todayRec = getStaffTodayRecord(selectedStaffForAction.id);
                const isCurrentlyClockedIn = todayRec && todayRec.status !== 'completed';

                if (!isCurrentlyClockedIn) {
                  return (
                    <button
                      type="button"
                      onClick={() => handleExecuteClockIn(selectedStaffForAction.id, 'pin')}
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <LogIn className="w-4 h-4" />
                      Clock In Now (Start Shift)
                    </button>
                  );
                }

                if (todayRec.status === 'on_break') {
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleExecuteBreakEnd(selectedStaffForAction.id)}
                        className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Resume Duty (End Break)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExecuteClockOut(selectedStaffForAction.id)}
                        className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <LogOut className="w-4 h-4" />
                        Clock Out (End Shift)
                      </button>
                    </div>
                  );
                }

                // If currently present / active
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleExecuteBreakStart(selectedStaffForAction.id)}
                      className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Coffee className="w-4 h-4" />
                      Take Break
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecuteClockOut(selectedStaffForAction.id)}
                      className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Clock Out (End Shift)
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : null}

          {/* Tactile On-Screen Numpad */}
          <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto w-full">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumpadPress(num)}
                className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-mono font-bold text-lg text-slate-800 dark:text-white transition-all active:scale-95 shadow-sm"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearPin}
              className="h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleNumpadPress('0')}
              className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-mono font-bold text-lg text-slate-800 dark:text-white transition-all active:scale-95 shadow-sm"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => {
                if (pinInput.length === 4 && !selectedStaffForAction) {
                  const matched = staffMembers.find(s => s.pin === pinInput.trim());
                  if (matched) setSelectedStaffForAction(matched);
                }
              }}
              className="h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1"
            >
              Enter
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Today's Attendance Roster & Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Today&apos;s Live Attendance Ledger</h3>
            <p className="text-xs text-slate-500">Live time tracking, break intervals, and worked hours</p>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search staff or code..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Attendance Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role & Dept</th>
                <th className="py-3 px-4">Clock In</th>
                <th className="py-3 px-4">Break Total</th>
                <th className="py-3 px-4">Clock Out</th>
                <th className="py-3 px-4">Total Worked</th>
                <th className="py-3 px-4">Punch Method</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStaffList.map(staff => {
                const record = getStaffTodayRecord(staff.id);
                const isClockedIn = record && record.status !== 'completed';

                return (
                  <tr key={staff.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                          style={{ backgroundColor: staff.avatarColor || '#2563eb' }}
                        >
                          {staff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">{staff.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 font-semibold">{staff.employeeCode}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-700 dark:text-slate-200 capitalize">
                        {staff.role.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{staff.department || 'Floor'}</span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {record ? new Date(record.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {record && record.totalBreakMinutes > 0 ? `${record.totalBreakMinutes} mins` : '—'}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {record?.clockOutTime ? new Date(record.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {record?.totalWorkedHours ? `${record.totalWorkedHours} hrs` : record?.clockInTime ? 'Active now' : '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      {record ? (
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {record.method}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        record?.status === 'present'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40'
                          : record?.status === 'on_break'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/40'
                          : record?.status === 'completed'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          record?.status === 'present' ? 'bg-emerald-500 animate-pulse' :
                          record?.status === 'on_break' ? 'bg-amber-500' :
                          record?.status === 'completed' ? 'bg-slate-400' : 'bg-rose-400'
                        }`} />
                        {record?.status ? record.status.replace(/_/g, ' ') : 'Not Checked In'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {!isClockedIn ? (
                        <button
                          type="button"
                          onClick={() => handleExecuteClockIn(staff.id, 'manual')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors shadow-sm inline-flex items-center gap-1"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Clock In
                        </button>
                      ) : record?.status === 'on_break' ? (
                        <button
                          type="button"
                          onClick={() => handleExecuteBreakEnd(staff.id)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors shadow-sm inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Resume
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleExecuteClockOut(staff.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition-colors shadow-sm inline-flex items-center gap-1"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Clock Out
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
