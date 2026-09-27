import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, KeyRound, ArrowRight, ShieldCheck, 
  Sparkles, Lock, User, AlertCircle, Loader2, Utensils, 
  ChefHat, Wine, Boxes, Eye, EyeOff
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StaffMember } from '../../types';

interface StaffPortalActivationModalProps {
  email: string;
  token: string;
  staffId?: string;
  onClose: () => void;
}

export const StaffPortalActivationModal: React.FC<StaffPortalActivationModalProps> = ({
  email,
  token,
  staffId,
  onClose
}) => {
  const { staffMembers, verifyStaffByToken } = useApp();

  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();
    const found = staffMembers.find(s => 
      (staffId && s.id === staffId) ||
      s.email?.toLowerCase() === cleanEmail ||
      (cleanToken && s.verificationToken === cleanToken)
    );

    if (found) {
      setStaff(found);
      if (found.pin) {
        setPin(found.pin);
        setConfirmPin(found.pin);
      }
    }
  }, [email, token, staffId, staffMembers]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPin = pin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('Please enter a 4-digit numeric PIN (0-9).');
      return;
    }

    if (confirmPin.trim() !== cleanPin) {
      setError('PIN and confirmation PIN do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyStaffByToken(email, token, cleanPin);
      if (res.success) {
        setCompleted(true);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.message || 'Verification could not be completed.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please contact your manager.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200"
      style={{ zIndex: 10000 }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transition-all text-slate-800 dark:text-slate-100">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 p-6 sm:p-7 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white shadow-lg mb-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Quick IMS Staff Portal
          </h2>
          <p className="mt-1 text-xs text-indigo-100 font-medium">
            One-Time Email Verification & Portal Activation
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-5">
          {completed ? (
            <div className="text-center py-6 space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Account Activated!
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
                Your email is confirmed and your 4-digit PIN is active. Logging you into the Staff Portal...
              </p>
              <div className="flex items-center justify-center gap-2 pt-2 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Opening workspace...</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-4">
              
              {/* Staff Member Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3.5">
                <div 
                  className="w-12 h-12 rounded-xl text-white font-bold flex items-center justify-center text-lg shadow-sm shrink-0"
                  style={{ backgroundColor: staff?.avatarColor || '#4f46e5' }}
                >
                  {staff?.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {staff?.name || 'Staff Member'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {staff?.role || 'Staff'}
                    </span>
                  </div>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {email} • {staff?.department || 'Operations'}
                  </p>
                </div>
              </div>

              {/* Username notice */}
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-2.5">
                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-2xs">
                  <span className="font-semibold text-indigo-900 dark:text-indigo-200">Your Login Username: </span>
                  <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                    {staff?.username || staff?.employeeCode || email.split('@')[0]}
                  </span>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    After activating now, you can sign in directly anytime by entering this username and your 4-digit PIN! No more typing email and password!
                  </p>
                </div>
              </div>

              {/* Error notice */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <p className="text-2xs font-medium">{error}</p>
                </div>
              )}

              {/* PIN Settings */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Set Your 4-Digit Quick PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-2xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPin ? 'Hide PIN' : 'Show PIN'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={4}
                        required
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full pl-9 pr-3 py-2.5 text-center font-mono tracking-widest text-base font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <p className="mt-1 text-3xs text-slate-500 text-center">4-digit PIN</p>
                  </div>

                  <div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={4}
                        required
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full pl-9 pr-3 py-2.5 text-center font-mono tracking-widest text-base font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <p className="mt-1 text-3xs text-slate-500 text-center">Confirm PIN</p>
                  </div>
                </div>

                {/* Assigned Permissions Preview */}
                {staff?.permissions && (
                  <div className="pt-2">
                    <p className="text-3xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Permissions Granted by Owner:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {staff.permissions.canPunchOrders && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <Utensils className="w-3 h-3" /> Punch Orders / POS
                        </span>
                      )}
                      {staff.permissions.canAccessKDS && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          <ChefHat className="w-3 h-3" /> Kitchen KDS
                        </span>
                      )}
                      {staff.permissions.canAccessBOT && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Wine className="w-3 h-3" /> Bar BOT
                        </span>
                      )}
                      {staff.permissions.canAccessInventory && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          <Boxes className="w-3 h-3" /> Inventory Access
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || pin.length !== 4}
                className="w-full mt-3 py-3 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activating Staff Portal...</span>
                  </>
                ) : (
                  <>
                    <span>Activate & Enter Staff Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center text-3xs text-slate-500">
          <span>Verification is required once. Future sign-ins use your username & 4-digit PIN.</span>
        </div>

      </div>
    </div>
  );
};
