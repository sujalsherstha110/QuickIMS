import React, { useState } from 'react';
import { Mail, CheckCircle2, LogOut, Sparkles, ArrowRight, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const EmailVerificationView: React.FC = () => {
  const { 
    firebaseUser, 
    checkEmailVerification, 
    sendVerificationEmail,
    markEmailAsVerified,
    logout, 
    enterDemoMode 
  } = useApp();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [bypassing, setBypassing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'info' | 'error' | 'success'; message: string } | null>(null);

  const handleDirectActivate = async () => {
    setBypassing(true);
    setFeedback(null);
    try {
      await markEmailAsVerified();
      setFeedback({
        type: 'success',
        message: 'Email confirmed! Direct entry granted. Entering workspace...'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Verification activation failed.'
      });
    } finally {
      setBypassing(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      const verified = await checkEmailVerification();
      if (verified) {
        setFeedback({
          type: 'success',
          message: 'Email verified successfully! Loading your workspace...'
        });
      } else {
        setFeedback({
          type: 'info',
          message: 'Verification link has not been confirmed yet. Click the link in your email, or tap Verify & Enter Workspace Directly.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Unable to check verification status. Please try again.'
      });
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setFeedback(null);
    try {
      await sendVerificationEmail();
      setResendSuccess(true);
      setFeedback({
        type: 'success',
        message: `A new verification email with a code has been sent to ${firebaseUser?.email}. Please check your inbox and spam folder.`
      });
      setTimeout(() => setResendSuccess(false), 30000);
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        setFeedback({
          type: 'error',
          message: 'Too many requests. Please wait a moment before requesting another email.'
        });
      } else {
        setFeedback({
          type: 'error',
          message: err.message || 'Failed to resend verification email.'
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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 mb-3 ring-4 ring-indigo-50 dark:ring-indigo-950/50">
            <span className="text-2xl font-black tracking-tight">Q</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Quick IMS
          </h2>
        </div>

        {/* Verification Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none p-6 sm:p-8 space-y-6">
          
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Mail className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Verify Your Email
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              We sent a verification confirmation link to:
            </p>

            <div className="inline-block px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs border border-slate-200 dark:border-slate-700 break-all">
              {firebaseUser?.email || 'Your registered email'}
            </div>

            <p className="text-2xs text-slate-500 dark:text-slate-400 leading-normal">
              Please check your inbox (and spam folder). Click the verification link in the email, then tap <strong>I Have Clicked the Link</strong> below.
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
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-2xs uppercase tracking-wider">
                  {feedback.type === 'success' ? 'Verified' : feedback.type === 'error' ? 'Notice' : 'Verification Status'}
                </p>
                <p className="mt-0.5 text-2xs leading-normal">{feedback.message}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-1">
            <button
              id="btn-activate-account-directly"
              type="button"
              onClick={handleDirectActivate}
              disabled={bypassing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{bypassing ? 'Opening Workspace...' : 'Verify & Enter Workspace Directly'}</span>
            </button>

            <button
              id="btn-check-email-verification"
              type="button"
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Checking Status...' : "I Have Clicked the Link in My Email"}</span>
            </button>

            <button
              id="btn-resend-verification-email"
              type="button"
              onClick={handleResend}
              disabled={resending || resendSuccess}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{resendSuccess ? 'Verification Link Dispatched — Check Inbox' : resending ? 'Dispatching...' : 'Resend Verification Link'}</span>
            </button>
          </div>

          {/* Delivery Note */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-left">
            <div className="flex items-center gap-1.5 text-2xs font-semibold text-slate-700 dark:text-slate-300">
              <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Tip for Gmail users</span>
            </div>
            <p className="mt-1 text-3xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Google Cloud Identity verification emails are sent from <em>noreply@gen-lang-client-...firebaseapp.com</em>. If not in Primary, check your Spam or Promotions tabs. You can also tap <strong>Verify & Enter Workspace Directly</strong> above to proceed immediately.
            </p>
          </div>

          {/* Additional Options */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-3">
            <button
              id="btn-verification-logout"
              onClick={logout}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign in with a different account</span>
            </button>

            <button
              id="btn-verification-demo"
              onClick={enterDemoMode}
              className="text-2xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Explore in Demo Mode without verification</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

        </div>

        <div className="mt-6 text-center text-3xs text-slate-400 dark:text-slate-500">
          <p>© 2026 Quick IMS</p>
        </div>

      </div>
    </div>
  );
};
