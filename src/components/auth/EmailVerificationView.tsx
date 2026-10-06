import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, LogOut, Sparkles, ArrowRight, AlertCircle, Info, ShieldAlert, Clock, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const RESEND_COOLDOWN_STORAGE_KEY = 'quickims_resend_cooldown_expiry';

export const EmailVerificationView: React.FC = () => {
  const { 
    firebaseUser, 
    checkEmailVerification, 
    sendVerificationEmail,
    logout, 
    deleteCurrentAccount,
    enterDemoMode,
    markEmailAsVerified
  } = useApp();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ 
    type: 'info' | 'error' | 'success'; 
    title?: string;
    message: string 
  } | null>(null);

  // Initialize and run the countdown timer for the Resend button
  useEffect(() => {
    const checkCooldown = () => {
      const storedExpiry = localStorage.getItem(RESEND_COOLDOWN_STORAGE_KEY);
      if (storedExpiry) {
        const remaining = Math.max(0, Math.ceil((parseInt(storedExpiry, 10) - Date.now()) / 1000));
        setCooldownSeconds(remaining);
        if (remaining <= 0) {
          localStorage.removeItem(RESEND_COOLDOWN_STORAGE_KEY);
        }
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerCooldown = (seconds: number) => {
    const expiry = Date.now() + seconds * 1000;
    localStorage.setItem(RESEND_COOLDOWN_STORAGE_KEY, expiry.toString());
    setCooldownSeconds(seconds);
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      const verified = await checkEmailVerification();
      if (verified) {
        setFeedback({
          type: 'success',
          title: 'Email Verified',
          message: 'Your email address has been verified successfully! Loading your workspace...'
        });
      } else {
        setFeedback({
          type: 'info',
          title: 'Verification Pending',
          message: 'The email link has not been confirmed yet. Please open the verification email, click the link inside to verify, and then click this button again.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Status Check Error',
        message: err.message || 'Unable to check verification status. Please try again.'
      });
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (cooldownSeconds > 0 || resending) return;
    setResending(true);
    setFeedback(null);

    try {
      await sendVerificationEmail();
      triggerCooldown(60); // 60s cooldown to prevent Firebase rate-limit (auth/too-many-requests)
      setFeedback({
        type: 'success',
        title: 'Verification Link Sent',
        message: `A fresh verification link has been dispatched to ${firebaseUser?.email || 'your email'}. Please check your Gmail Inbox, Spam, and Promotions folders.`
      });
    } catch (err: any) {
      const isTooManyRequests = 
        err.code === 'auth/too-many-requests' || 
        err.message?.includes('too-many-requests') ||
        err.message?.includes('TOO_MANY_ATTEMPTS_TRY_LATER');

      if (isTooManyRequests) {
        triggerCooldown(120); // Impose 2-minute cooldown
        setFeedback({
          type: 'error',
          title: 'Firebase Rate Limit Reached',
          message: 'Firebase temporarily paused new email dispatches because multiple requests were triggered in a short time. An email is already on its way to your inbox or spam folder. Please wait 2 minutes before requesting another link.'
        });
      } else {
        setFeedback({
          type: 'error',
          title: 'Delivery Notice',
          message: err.message || 'Failed to dispatch verification email. Please try again later.'
        });
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 mb-3 ring-4 ring-blue-50 dark:ring-blue-950/50">
            <span className="text-2xl font-black tracking-tight">Q</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Quick IMS
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Security & Identity Protection
          </p>
        </div>

        {/* Verification Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none p-6 sm:p-8 space-y-6">
          
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Mail className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Verify Your Email Address
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              To protect your business data and secure your inventory access, please verify your email before entering:
            </p>

            <div className="inline-block px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs border border-slate-200 dark:border-slate-700 break-all font-mono">
              {firebaseUser?.email || 'Your registered email'}
            </div>

            <p className="text-2xs text-slate-500 dark:text-slate-400 leading-normal">
              Open the verification email sent to your inbox, click the confirmation link, and then return here.
            </p>
          </div>

          {/* Dynamic Feedback Banner */}
          {feedback && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                : feedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              ) : feedback.type === 'error' ? (
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              )}
              <div className="flex-1">
                {feedback.title && (
                  <p className="font-semibold text-2xs uppercase tracking-wider">
                    {feedback.title}
                  </p>
                )}
                <p className="mt-0.5 text-2xs leading-normal">{feedback.message}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-1">
            <button
              id="btn-check-email-verification"
              type="button"
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Confirming with Firebase...' : "I Have Clicked the Link in My Email"}</span>
            </button>

            <button
              id="btn-resend-verification-email"
              type="button"
              onClick={handleResend}
              disabled={resending || cooldownSeconds > 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldownSeconds > 0 ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
                  <span>Resend available in {cooldownSeconds}s</span>
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  <span>{resending ? 'Dispatching Email...' : 'Resend Verification Link'}</span>
                </>
              )}
            </button>
          </div>

          {/* Delivery & Anti-Spam Guidance */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-left space-y-2">
            <div className="flex items-center gap-1.5 text-2xs font-semibold text-slate-700 dark:text-slate-300">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Where to find your verification email</span>
            </div>
            <ul className="text-3xs text-slate-500 dark:text-slate-400 space-y-1.5 list-disc pl-3.5 leading-relaxed">
              <li>
                <strong>Sender:</strong> Look for an email from <span className="font-mono text-slate-700 dark:text-slate-300">noreply@...firebaseapp.com</span>.
              </li>
              <li>
                <strong>Spam / Promotions:</strong> In Gmail, check your <strong>Spam</strong>, <strong>Junk</strong>, and <strong>Promotions</strong> tabs if it is not in your Primary inbox.
              </li>
              <li>
                <strong>Rate Limiting:</strong> To prevent email abuse and spoofing, Firebase limits how frequently verification links can be requested per minute.
              </li>
            </ul>
          </div>

          {/* Additional Options */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-3">
            <button
              id="btn-verification-logout"
              onClick={logout}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out / Use a different email</span>
            </button>

            {!showDeleteConfirm ? (
              <button
                id="btn-trigger-delete-account"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-2xs text-rose-600 hover:text-rose-700 dark:text-rose-400 inline-flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete this account & start fresh</span>
              </button>
            ) : (
              <div className="w-full p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-2 text-center animate-in fade-in zoom-in-95 duration-150">
                <p className="text-2xs font-bold text-rose-700 dark:text-rose-300">
                  Are you sure you want to delete this account?
                </p>
                <p className="text-3xs text-rose-600/90 dark:text-rose-400">
                  This removes <span className="font-mono font-semibold">{firebaseUser?.email}</span> so you can immediately create a brand new account or re-register.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    id="btn-confirm-delete-account"
                    type="button"
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true);
                      try {
                        await deleteCurrentAccount();
                      } catch (err: any) {
                        setFeedback({
                          type: 'error',
                          title: 'Account Deletion Error',
                          message: err.message || 'Failed to delete account. You can also sign out.'
                        });
                        setDeleting(false);
                        setShowDeleteConfirm(false);
                      }
                    }}
                    className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-2xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete Account'}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setShowDeleteConfirm(false)}
                    className="py-1.5 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-2xs font-medium hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <button
              id="btn-verification-instant-confirm"
              type="button"
              onClick={async () => {
                await markEmailAsVerified();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verify Now & Open Restaurant Dashboard</span>
            </button>

            <button
              id="btn-verification-skip"
              type="button"
              onClick={enterDemoMode}
              className="w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Skip Verification & Open Restaurant (Preview Mode)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        <div className="mt-6 text-center text-3xs text-slate-400 dark:text-slate-500">
          <p>© 2026 Quick IMS • Enterprise Inventory Management</p>
        </div>

      </div>
    </div>
  );
};
