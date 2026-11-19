import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, AlertCircle, ArrowRight, UserCheck, Shield, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StaffMember } from '../../types';

interface StaffPinSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StaffPinSwitchModal: React.FC<StaffPinSwitchModalProps> = ({ isOpen, onClose }) => {
  const { staffMembers, activePOSStaff, activeStaffUser, switchActiveStaffByPin, resetStaffData } = useApp();
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNumpad = (num: string) => {
    if (pinInput.length < 4) {
      const nextPin = pinInput + num;
      setPinInput(nextPin);
      setErrorMsg(null);

      // Auto-submit on 4th digit
      if (nextPin.length === 4) {
        const res = switchActiveStaffByPin(nextPin);
        if (res.success) {
          onClose();
        } else {
          setErrorMsg(res.message);
          setPinInput('');
        }
      }
    }
  };

  const handleClear = () => {
    setPinInput('');
    setErrorMsg(null);
  };

  const handleDirectSelect = (staff: StaffMember) => {
    // Prompt for PIN or verify
    const res = switchActiveStaffByPin(staff.pin);
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Switch POS Operator</h3>
              <p className="text-[11px] text-slate-500">Enter your 4-digit PIN</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col items-center">
          {activePOSStaff && (
            <div className="w-full mb-4 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-400">Current Operator:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {activePOSStaff.name} ({activePOSStaff.employeeCode})
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="w-full mb-3 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Dots */}
          <div className="flex items-center gap-3 my-2">
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                className={`w-10 h-12 rounded-2xl flex items-center justify-center font-mono text-lg font-black border-2 transition-all ${
                  pinInput.length > idx
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 scale-105'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-300'
                }`}
              >
                {pinInput.length > idx ? '●' : '—'}
              </div>
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[260px] mt-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumpad(num)}
                className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-mono font-bold text-base text-slate-800 dark:text-white transition-all active:scale-95 shadow-2xs"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-12 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 text-xs font-bold transition-all active:scale-95"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleNumpad('0')}
              className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-mono font-bold text-base text-slate-800 dark:text-white transition-all active:scale-95 shadow-2xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => {
                if (pinInput.length === 4) {
                  const res = switchActiveStaffByPin(pinInput);
                  if (res.success) onClose();
                  else {
                    setErrorMsg(res.message);
                    setPinInput('');
                  }
                }
              }}
              className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all active:scale-95 flex items-center justify-center"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Staff Switch Chips */}
          <div className="w-full mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2 text-center">
              Or 1-Tap Quick Switch (Demo PIN Mode)
            </span>
            <div className="flex flex-wrap gap-1.5 justify-center max-h-24 overflow-y-auto">
              {staffMembers.map(staff => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => handleDirectSelect(staff)}
                  className={`px-2 py-1 rounded-xl text-[10px] font-semibold flex items-center gap-1 border transition-all ${
                    activePOSStaff?.id === staff.id
                      ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/80 dark:border-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: staff.avatarColor || '#2563eb' }} 
                  />
                  <span>{staff.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-slate-400 font-mono">({staff.pin})</span>
                </button>
              ))}
            </div>

            {!activeStaffUser && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                <button
                  type="button"
                  onClick={async () => {
                    await resetStaffData();
                    onClose();
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer flex items-center gap-1.5"
                  title="Reset all staff members to default test profiles"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Staff Data (Defaults)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
