import React, { useState } from 'react';
import { Mail, CheckCircle2, RefreshCw, LogOut, Sparkles, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const EmailVerificationView: React.FC = () => {
  const { 
    firebaseUser, 
    checkEmailVerification, 
    sendVerificationEmail,
    verifyEmailWithCode,
    logout, 
    enterDemoMode 
  } = useApp();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [code, setCode] = useState('');
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'info' | 'error' | 'success'; message: string } | null>(null);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please enter the 6-digit verification code sent to your email.'
      });
      return;
    }
    setCodeSubmitting(true);
    setFeedback(null);
    try {
      const verified = await verifyEmailWithCode(code.trim());
      if (verified) {
        setFeedback({
          type: 'success',
          message: 'Code confirmed! Email verified successfully. Entering workspace...'
        });
      } else {
        setFeedback({
          type: 'error',
          message: 'Invalid verification code. Please check the code in your email and try again.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Verification failed.'
      });
    } finally {
      setCodeSubmitting(false);
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
          message: 'Email is not verified yet. Please check your inbox or enter the 6-digit code sent to your email.'
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
              Check Your Email
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              We sent a verification confirmation and 6-digit code to:
            </p>

            <div className="inline-block px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs border border-slate-200 dark:border-slate-700 break-all">
              {firebaseUser?.email || 'Your registered email'}
            </div>

            <p className="text-2xs text-slate-500 dark:text-slate-400 leading-normal">
              Please check your inbox (and spam folder) and enter the 6-digit code below to confirm your account.
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

          {/* Code verification form */}
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Enter 6-Digit Code from Email
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="input-verification-code"
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  className="w-full pl-9 pr-24 py-2.5 text-xs font-mono tracking-widest bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={codeSubmitting || !code}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-2xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {codeSubmitting ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            </div>
          </form>

          {/* Status & Resend Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              id="btn-check-email-verification"
              type="button"
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Checking Status...' : "I Clicked the Link in My Email"}</span>
            </button>

            <button
              id="btn-resend-verification-email"
              type="button"
              onClick={handleResend}
              disabled={resending || resendSuccess}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{resendSuccess ? 'Email Resent — Check Inbox' : resending ? 'Dispatching...' : 'Resend Verification Email'}</span>
            </button>
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
