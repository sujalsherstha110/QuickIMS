import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, KeyRound, Check, ShieldCheck, AlertCircle, Delete } from 'lucide-react';
import { StaffMember } from '../../types';
import { verifyPosActionPin } from '../../utils/staffPermissionUtils';

export type PosActionPinAccent = 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo';

interface PosActionPinModalProps {
  isOpen: boolean;
  title: string;
  detail?: string;
  accent?: PosActionPinAccent;
  currentOperator: StaffMember | null;
  staffMembers: StaffMember[];
  onClose: () => void;
  onVerified: (authorizedBy: string) => void | Promise<void>;
}

const ACCENT_MAP: Record<
  PosActionPinAccent,
  { iconBg: string; iconText: string; badge: string; btn: string }
> = {
  blue: {
    iconBg: 'bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800',
    iconText: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    btn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
  },
  emerald: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25'
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800',
    iconText: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/25'
  },
  rose: {
    iconBg: 'bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800',
    iconText: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25'
  },
  indigo: {
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25'
  }
};

export const PosActionPinModal: React.FC<PosActionPinModalProps> = ({
  isOpen,
  title,
  detail,
  accent = 'indigo',
  currentOperator,
  staffMembers,
  onClose,
  onVerified
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMsg(null);
      setIsVerifying(false);
      submittingRef.current = false;
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, title, detail]);

  const attemptVerify = useCallback(
    async (pinValue: string) => {
      if (submittingRef.current || !isOpen) return;
      const result = verifyPosActionPin(pinValue, currentOperator, staffMembers);
      if ('error' in result) {
        setErrorMsg(result.error);
        setPinInput('');
        setTimeout(() => inputRef.current?.focus(), 20);
        return;
      }

      submittingRef.current = true;
      setIsVerifying(true);
      setErrorMsg(null);
      try {
        await onVerified(result.authorizedBy);
      } finally {
        submittingRef.current = false;
        setIsVerifying(false);
      }
    },
    [isOpen, currentOperator, staffMembers, onVerified]
  );

  const appendDigit = useCallback(
    (digit: string) => {
      if (submittingRef.current || isVerifying) return;
      setErrorMsg(null);
      setPinInput(prev => {
        if (prev.length >= 4) return prev;
        const next = prev + digit;
        if (next.length === 4) {
          queueMicrotask(() => {
            void attemptVerify(next);
          });
        }
        return next;
      });
    },
    [attemptVerify, isVerifying]
  );

  const removeLastDigit = useCallback(() => {
    if (submittingRef.current || isVerifying) return;
    setErrorMsg(null);
    setPinInput(prev => prev.slice(0, -1));
  }, [isVerifying]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        appendDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        removeLastDigit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void attemptVerify(pinInput);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, appendDigit, removeLastDigit, onClose, attemptVerify, pinInput]);

  if (!isOpen) return null;

  const theme = ACCENT_MAP[accent];

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${theme.iconBg}`}>
              <KeyRound className={`w-5 h-5 ${theme.iconText}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                {title}
              </h3>
              {detail && (
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {detail}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isVerifying}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Operator Info (Never shows PIN) */}
        <div className={`px-3 py-2 rounded-xl border text-[11px] font-semibold flex items-center justify-between gap-2 ${theme.badge}`}>
          <span className="flex items-center gap-1.5 truncate">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Operator: <strong className="font-extrabold">{currentOperator?.name || 'Staff'}</strong>
            </span>
          </span>
          <span className="text-[10px] uppercase tracking-wider opacity-80 shrink-0">
            4-Digit PIN
          </span>
        </div>

        {/* Hidden keyboard input + masked 4-dot PIN display */}
        <form
          onSubmit={e => {
            e.preventDefault();
            void attemptVerify(pinInput);
          }}
          className="space-y-3"
        >
          <div
            onClick={() => inputRef.current?.focus()}
            className="cursor-text select-none flex flex-col items-center gap-2 py-2"
          >
            <div className="flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map(idx => {
                const filled = idx < pinInput.length;
                const active = idx === pinInput.length && !isVerifying;
                return (
                  <div
                    key={idx}
                    className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all ${
                      errorMsg
                        ? 'border-rose-400 bg-rose-50/70 dark:bg-rose-950/30'
                        : filled
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-xs'
                        : active
                        ? 'border-indigo-400 bg-white dark:bg-slate-800 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70'
                    }`}
                  >
                    {filled ? (
                      <span className="w-3 h-3 rounded-full bg-slate-900 dark:bg-white" />
                    ) : (
                      <span className="w-2 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                    )}
                  </div>
                );
              })}
            </div>

            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="one-time-code"
              value={pinInput}
              onChange={e => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
                setErrorMsg(null);
                setPinInput(digitsOnly);
                if (digitsOnly.length === 4) {
                  queueMicrotask(() => {
                    void attemptVerify(digitsOnly);
                  });
                }
              }}
              aria-label="Enter 4-digit staff PIN"
              className="sr-only"
            />
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Touch Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
              <button
                key={digit}
                type="button"
                disabled={isVerifying}
                onClick={() => appendDigit(digit)}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-mono font-extrabold text-base transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              disabled={isVerifying}
              onClick={() => {
                setPinInput('');
                setErrorMsg(null);
                inputRef.current?.focus();
              }}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={isVerifying}
              onClick={() => appendDigit('0')}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-mono font-extrabold text-base transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700"
            >
              0
            </button>
            <button
              type="button"
              disabled={isVerifying}
              onClick={removeLastDigit}
              aria-label="Backspace"
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              disabled={isVerifying}
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pinInput.length !== 4 || isVerifying}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all ${
                pinInput.length !== 4 || isVerifying
                  ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed shadow-none'
                  : `${theme.btn} cursor-pointer`
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isVerifying ? 'Verifying...' : 'Confirm'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
