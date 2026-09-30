import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, KeyRound, ArrowRight, ShieldCheck, 
  Sparkles, Lock, User, AlertCircle, Loader2, Utensils, 
  ChefHat, Wine, Boxes, Eye, EyeOff, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StaffMember } from '../../types';
import { db } from '../../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

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
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanToken = token ? token.trim() : '';
    const cleanStaffId = staffId ? staffId.trim() : '';

    const resolveStaffProfile = async () => {
      // 1. Search in local state
      let found = staffMembers.find(s => 
        (cleanStaffId && s.id === cleanStaffId) ||
        (cleanToken && s.verificationToken === cleanToken) ||
        (cleanEmail && s.email?.toLowerCase() === cleanEmail)
      );

      // 2. Search in localStorage
      if (!found && typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('quickims_staff');
          if (cached) {
            const list: StaffMember[] = JSON.parse(cached);
            if (Array.isArray(list)) {
              found = list.find(s => 
                (cleanStaffId && s.id === cleanStaffId) ||
                (cleanToken && s.verificationToken === cleanToken) ||
                (cleanEmail && s.email?.toLowerCase() === cleanEmail)
              );
            }
          }
        } catch {}
      }

      // 3. Search in Firestore
      if (!found) {
        try {
          if (cleanStaffId) {
            const docSnap = await getDoc(doc(db, 'staff_members', cleanStaffId)).catch(() => null);
            if (docSnap && docSnap.exists()) {
              found = { ...docSnap.data(), id: docSnap.id } as StaffMember;
            }
          }

          if (!found && cleanStaffId) {
            const vSnap = await getDoc(doc(db, 'staff_verifications', cleanStaffId)).catch(() => null);
            if (vSnap && vSnap.exists()) {
              const vData = vSnap.data();
              if (vData.staffMember) found = vData.staffMember;
            }
          }

          if (!found && cleanEmail) {
            const vSnap = await getDoc(doc(db, 'staff_verifications', cleanEmail)).catch(() => null);
            if (vSnap && vSnap.exists()) {
              const vData = vSnap.data();
              if (vData.staffMember) found = vData.staffMember;
              else if (vData.staffId) {
                const sSnap = await getDoc(doc(db, 'staff_members', vData.staffId)).catch(() => null);
                if (sSnap && sSnap.exists()) found = { ...sSnap.data(), id: sSnap.id } as StaffMember;
              }
            }
          }

          if (!found) {
            const allSnap = await getDocs(collection(db, 'staff_members')).catch(() => null);
            if (allSnap && !allSnap.empty) {
              const list = allSnap.docs.map(d => ({ ...d.data(), id: d.id } as StaffMember));
              found = list.find(s => 
                (cleanStaffId && s.id === cleanStaffId) ||
                (cleanToken && s.verificationToken === cleanToken) ||
                (cleanEmail && s.email?.toLowerCase() === cleanEmail)
              );
            }
          }
        } catch (e) {
          console.warn('Error querying staff in Firestore:', e);
        }
      }

      if (isMounted) {
        if (found) {
          setStaff(found);
          if (found.pin) {
            setPin(found.pin);
            setConfirmPin(found.pin);
          }
        }
        setLoadingStaff(false);
      }
    };

    resolveStaffProfile();

    return () => {
      isMounted = false;
    };
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
      const res = await verifyStaffByToken(email, token, cleanPin, staffId || staff?.id);
      if (res.success) {
        setCompleted(true);
        // Clean URL query parameters
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transition-all text-slate-800 dark:text-slate-100 relative">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Close Modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 p-6 sm:p-7 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white shadow-lg mb-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Quick IMS Staff Portal
          </h2>
          <p className="mt-1 text-xs text-blue-100 font-medium">
            One-Time Email Verification & Portal Activation
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-5">
          {loadingStaff ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center animate-in fade-in duration-150">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Resolving staff verification link...
                </p>
                <p className="text-2xs text-slate-500">
                  Checking secure staff credentials and activation permissions
                </p>
              </div>
            </div>
          ) : !staff ? (
            <div className="py-8 text-center space-y-4 animate-in fade-in duration-200">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Staff Profile Not Found
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
                  Staff profile matching this verification link was not found. Please ask the manager or owner to copy a fresh link from the Staff Directory.
                </p>
                {(email || staffId) && (
                  <div className="pt-2 text-2xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 p-2.5 rounded-xl text-left max-w-xs mx-auto space-y-0.5">
                    {email && <div>Email: {email}</div>}
                    {staffId && <div>Staff ID: {staffId}</div>}
                  </div>
                )}
              </div>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors shadow-xs"
                >
                  Return to Portal Sign-In
                </button>
              </div>
            </div>
          ) : completed ? (
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
              <div className="flex items-center justify-center gap-2 pt-2 text-blue-600 dark:text-blue-400 text-xs font-semibold">
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
                  style={{ backgroundColor: staff?.avatarColor || '#2563eb' }}
                >
                  {staff?.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {staff?.name || 'Staff Member'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {staff?.role || 'Staff'}
                    </span>
                  </div>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {email} • {staff?.department || 'Operations'}
                  </p>
                </div>
              </div>

              {/* Username notice */}
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-start gap-2.5">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-2xs">
                  <span className="font-semibold text-blue-900 dark:text-blue-200">Your Login Username: </span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
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
                    className="text-2xs font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
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
                        className="w-full pl-9 pr-3 py-2.5 text-center font-mono tracking-widest text-base font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
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
                        className="w-full pl-9 pr-3 py-2.5 text-center font-mono tracking-widest text-base font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
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
                className="w-full mt-3 py-3 px-4 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
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
