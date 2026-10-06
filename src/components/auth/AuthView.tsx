import React, { useState } from 'react';
import { 
  CheckCircle2, ArrowRight, AlertCircle, Loader2, Sparkles,
  Mail, Lock, User, Eye, EyeOff, KeyRound, ArrowLeft,
  Users, Building2, ShieldCheck, RefreshCw, Hash
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StaffMember } from '../../types';

export const AuthView: React.FC = () => {
  const { 
    loginWithGoogle, 
    loginWithEmail, 
    signUpWithEmail, 
    sendPasswordReset, 
    enterDemoMode,
    loginStaffByUsernameAndPin,
    sendStaffVerificationEmail,
    verifyStaffEmailWithCode
  } = useApp();

  // Portal switcher: 'staff' (Username + 4-digit PIN) or 'manager' (Email / Google)
  const [portalType, setPortalType] = useState<'staff' | 'manager'>('staff');

  // Manager auth mode
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Manager form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Staff portal inputs
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [showStaffPin, setShowStaffPin] = useState(false);
  const [unverifiedStaff, setUnverifiedStaff] = useState<StaffMember | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingStaffLink, setIsResendingStaffLink] = useState(false);

  const resetFormState = () => {
    setError(null);
    setSuccessMessage(null);
    setPassword('');
    setConfirmPassword('');
    setUnverifiedStaff(null);
  };

  // Staff Portal Login handler
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setUnverifiedStaff(null);

    const cleanUser = staffUsername.trim();
    const cleanPin = staffPin.trim();

    if (!cleanUser) {
      setError('Please enter your assigned username or employee code.');
      return;
    }
    if (!cleanPin || cleanPin.length !== 4) {
      setError('Please enter your 4-digit numeric PIN.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginStaffByUsernameAndPin(cleanUser, cleanPin);
      if (!res.success) {
        if (res.staff && res.staff.email && !res.staff.emailVerified) {
          setUnverifiedStaff(res.staff);
        }
        setError(res.message);
      } else {
        setSuccessMessage(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to log into Staff Portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Staff Verification Link
  const handleResendStaffVerification = async () => {
    if (!unverifiedStaff?.email) return;
    setIsResendingStaffLink(true);
    setError(null);
    try {
      await sendStaffVerificationEmail(unverifiedStaff.email, unverifiedStaff.name, unverifiedStaff.id);
      setSuccessMessage(`A fresh verification link has been sent to ${unverifiedStaff.email}. Please check your inbox and promotions folders.`);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResendingStaffLink(false);
    }
  };

  // Staff Instant OTP Code Confirmation
  const handleConfirmStaffOtp = async () => {
    if (!unverifiedStaff?.email || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit confirmation code.');
      return;
    }
    setIsVerifyingOtp(true);
    setError(null);
    try {
      const res = await verifyStaffEmailWithCode(unverifiedStaff.email, otpCode.trim(), unverifiedStaff.id);
      if (res.success) {
        setSuccessMessage(`Success! Email verified. You can now sign in with PIN.`);
        setUnverifiedStaff(null);
        setOtpCode('');
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Manager Email Authentication
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        await sendPasswordReset(email);
        setSuccessMessage(`A password reset link has been sent to ${email}. Please check your inbox.`);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          setError('No account found with this email address.');
        } else if (err.code === 'auth/invalid-email') {
          setError('Please provide a valid email address.');
        } else {
          setError(err.message || 'Failed to send password reset email.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter.');
        return;
      }

      setLoading(true);
      try {
        await signUpWithEmail(email, password, name);
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          setError('An account with this email already exists. Please sign in instead.');
        } else if (err.code === 'auth/invalid-email') {
          setError('Please enter a valid email address.');
        } else if (err.code === 'auth/weak-password') {
          setError('Password is too weak. Please use at least 6 characters.');
        } else if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
          setError('This preview domain requires email/password login. Please use Email & Password below or Explore in Demo Mode.');
        } else {
          setError(err.message || 'Failed to create account. Please try again.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // Sign In Mode
    setLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please verify your credentials.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Access temporarily disabled due to multiple failed attempts. Please try again later or reset password.');
      } else {
        setError(err.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed before completing. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('The sign-in popup was blocked by your browser. Please allow popups for this site.');
      } else if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setError('Google Login requires authorizing this preview domain in Firebase Console. Please sign in or create an account with Email & Password below directly.');
      } else {
        setError(err.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors">
      
      {/* Background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 mb-2.5 ring-4 ring-blue-50 dark:ring-blue-950/50">
            <span className="text-2xl font-black tracking-tight">Q</span>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Quick IMS
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Restaurant POS & Inventory Management System
          </p>
        </div>

        {/* Portal Switcher: Staff Portal vs Owner / Manager */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-200/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl text-xs font-bold mb-4 shadow-inner">
          <button
            type="button"
            onClick={() => { setPortalType('staff'); resetFormState(); }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
              portalType === 'staff'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Staff Portal (PIN)</span>
          </button>
          <button
            type="button"
            onClick={() => { setPortalType('manager'); resetFormState(); }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
              portalType === 'manager'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Owner / Manager</span>
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-6 sm:p-7 space-y-4">
          
          {/* Feedback Messages */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-2xs uppercase tracking-wider">Notice</p>
                <p className="mt-0.5 text-2xs leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-2xs uppercase tracking-wider">Success</p>
                <p className="mt-0.5 text-2xs leading-relaxed">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Unverified Staff Modal/Callout */}
          {unverifiedStaff && (
            <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-300 text-xs">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold">One-Time Email Verification Required</p>
                  <p className="text-2xs text-amber-700 dark:text-amber-400 mt-0.5">
                    A confirmation link was dispatched to <strong>{unverifiedStaff.email}</strong>. Open the link to activate your portal.
                  </p>
                </div>
              </div>

              {/* Action options */}
              <div className="pt-1 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isResendingStaffLink}
                  onClick={handleResendStaffVerification}
                  className="w-full py-2 px-3 text-2xs font-bold rounded-xl bg-amber-200/70 hover:bg-amber-300/80 text-amber-900 dark:bg-amber-900/60 dark:hover:bg-amber-900/80 dark:text-amber-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isResendingStaffLink ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Resending Link...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Resend Verification Email</span>
                    </>
                  )}
                </button>

                {/* 6-Digit OTP Alternative */}
                <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60 space-y-2">
                  <p className="text-3xs font-semibold text-amber-800 dark:text-amber-300">
                    Or enter 6-digit confirmation code from email / manager:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="flex-1 py-1.5 px-3 text-center font-mono font-bold tracking-widest text-xs rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 outline-none"
                    />
                    <button
                      type="button"
                      disabled={isVerifyingOtp || otpCode.length !== 6}
                      onClick={handleConfirmStaffOtp}
                      className="py-1.5 px-3 rounded-lg text-2xs font-bold bg-amber-700 hover:bg-amber-800 text-white disabled:opacity-50 cursor-pointer"
                    >
                      {isVerifyingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAFF PORTAL LOGIN FORM */}
          {portalType === 'staff' ? (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              
              <div className="text-left pb-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Enter Username & 4-Digit PIN</span>
                </span>
                <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Fast access for Waiters, Cashiers, Kitchen KDS, and Bar staff. Devices automatically connect to your restaurant.
                </p>
              </div>

              {/* Username Input */}
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Staff Username or Employee Code
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="input-staff-username"
                    type="text"
                    required
                    value={staffUsername}
                    onChange={(e) => setStaffUsername(e.target.value)}
                    placeholder="e.g. staff_pos or EMP-101"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* 4-Digit PIN Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    4-Digit Numeric PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowStaffPin(!showStaffPin)}
                    className="text-2xs font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
                  >
                    {showStaffPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showStaffPin ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="input-staff-pin"
                    type={showStaffPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={staffPin}
                    onChange={(e) => setStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full pl-9 pr-3 py-2.5 text-center font-mono tracking-widest text-lg font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <p className="mt-1 text-3xs text-slate-400 text-center">
                  Sign in with credentials provided by your restaurant owner.
                </p>
              </div>

              {/* Submit Button */}
              <button
                id="btn-staff-login"
                type="submit"
                disabled={loading || staffPin.length !== 4 || !staffUsername.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in to Staff Portal...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Staff Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Sample Staff Credentials for Fast Access */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="block text-3xs uppercase font-bold text-slate-400 tracking-wider mb-2 text-center">
                  Quick Select Role (1-Click Fill)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setStaffUsername('waiter'); setStaffPin('1234'); }}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-left transition-colors cursor-pointer"
                  >
                    <span className="block text-2xs font-bold text-slate-800 dark:text-slate-200">🍽️ Waiter / Server</span>
                    <span className="block text-3xs text-slate-500 font-mono">user: waiter • PIN: 1234</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStaffUsername('cashier'); setStaffPin('1234'); }}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-left transition-colors cursor-pointer"
                  >
                    <span className="block text-2xs font-bold text-slate-800 dark:text-slate-200">💳 Cashier / POS</span>
                    <span className="block text-3xs text-slate-500 font-mono">user: cashier • PIN: 1234</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStaffUsername('chef'); setStaffPin('1234'); }}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-left transition-colors cursor-pointer"
                  >
                    <span className="block text-2xs font-bold text-slate-800 dark:text-slate-200">👨‍🍳 Kitchen (KDS)</span>
                    <span className="block text-3xs text-slate-500 font-mono">user: chef • PIN: 1234</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStaffUsername('bar'); setStaffPin('1234'); }}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-left transition-colors cursor-pointer"
                  >
                    <span className="block text-2xs font-bold text-slate-800 dark:text-slate-200">🍸 Bar (BOT)</span>
                    <span className="block text-3xs text-slate-500 font-mono">user: bar • PIN: 1234</span>
                  </button>
                </div>
              </div>

            </form>
          ) : (
            /* OWNER / MANAGER AUTH FORM */
            <div className="space-y-4">
              
              {/* Mode Tabs: Sign In vs Create Account */}
              {mode !== 'forgot' ? (
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                  <button
                    id="auth-tab-signin"
                    type="button"
                    onClick={() => { setMode('signin'); resetFormState(); }}
                    className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
                      mode === 'signin'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    id="auth-tab-signup"
                    type="button"
                    onClick={() => { setMode('signup'); resetFormState(); }}
                    className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
                      mode === 'signup'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); resetFormState(); }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Reset Password</span>
                </div>
              )}

              {/* Email / Password Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3.5">
                
                {mode === 'signup' && (
                  <div>
                    <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                      Full Name / Business Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="input-auth-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Full Name"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="input-auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@business.com"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Password
                      </label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => { setMode('forgot'); resetFormState(); }}
                          className="text-2xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="input-auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="input-auth-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                <button
                  id="btn-submit-email-auth"
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>
                      {mode === 'signin' 
                        ? 'Sign In as Manager' 
                        : mode === 'signup' 
                        ? 'Create Business Account' 
                        : 'Send Password Reset Link'}
                    </span>
                  )}
                </button>

                {mode === 'signin' && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('admin@quickims.np');
                        setPassword('admin');
                      }}
                      className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                    >
                      Fill Default Manager: admin@quickims.np (password: admin)
                    </button>
                  </div>
                )}
              </form>

              {/* Social Auth Divider */}
              {mode !== 'forgot' && (
                <>
                  <div className="relative my-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-3xs uppercase tracking-wider font-semibold">
                      <span className="bg-white dark:bg-slate-900 px-3 text-slate-400">or continue with</span>
                    </div>
                  </div>

                  {/* Google Auth Button */}
                  <div>
                    <button
                      id="btn-google-auth"
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-xs shadow-xs hover:shadow-md active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                      <span>Sign in with Google</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Demo Mode Link */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              id="btn-demo-mode"
              type="button"
              onClick={enterDemoMode}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Explore full restaurant in Demo Mode</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Clean Footer */}
        <div className="mt-5 text-center text-3xs text-slate-400 dark:text-slate-500">
          <p>© 2026 Quick IMS • Secure Staffing & Authentication</p>
        </div>

      </div>
    </div>
  );
};
