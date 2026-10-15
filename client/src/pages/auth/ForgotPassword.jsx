import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader2, AlertCircle, Check, ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import api from '../../utils/api';
import ThemeToggle from '../../components/ThemeToggle';
import Logo from '../../components/Logo';
import usePageMeta from '../../utils/usePageMeta';
import notify from '../../utils/notify';
import { getErrorMessage } from '../../utils/errors';

const RESEND_SECONDS = 30;


export default function ForgotPassword() {
  usePageMeta({ title: 'Forgot password', description: "Enter your email and we'll send you a link to reset your RemindMe password." });
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef(null);

  // Count down the resend timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const emailTrim = email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTrim);

  const sendLink = async () => {
    if (loading) return;

    if (!emailValid) {
      setError('Enter a valid email like name@example.com');
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email: emailTrim });
      setSuccess(true);
      notify.success('If that email has an account, a reset link is on its way.');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendLink();
  };

  const useDifferentEmail = () => {
    setSuccess(false);
    setError('');
    setCooldown(0);
  };

  return (
    <div className="forgot-root relative flex items-center justify-center min-h-screen px-4 pt-24 pb-10 bg-gradient-to-b from-[color:var(--rm-hero-top)] to-[color:var(--rm-page)] overflow-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .forgot-root { font-family: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif; }
        @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .rise { animation: rise .45s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .rise { animation: none; } }
      `,
        }}
      />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4">
        <Logo />
        <ThemeToggle />
      </div>

      {/* Soft background glows */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-emerald-100/60 blur-3xl" />

      <div className="rise relative w-full max-w-md p-6 sm:p-9 bg-white rounded-[2rem] border border-sky-100 shadow-[0_30px_80px_-30px_rgba(37,99,235,0.35)]">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-6 w-fit group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
        >
          <span className="p-1.5 rounded-lg bg-[color:var(--rm-soft)] group-hover:bg-blue-100 transition-colors">
            <ArrowLeft size={16} />
          </span>
          Back to login
        </button>

        {success ? (
          /* Success state */
          <div className="text-center" role="status">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
              <MailCheck size={30} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-extrabold text-[color:var(--rm-ink)] tracking-tight">Check your email</h1>
            <p className="mt-3 text-slate-500 font-medium leading-relaxed">
              If an account exists for <strong className="text-slate-800 break-all">{emailTrim}</strong>, we've sent
              instructions to reset your password.
            </p>
            <p className="mt-2 text-xs text-slate-400">Can't see it? Check your spam folder.</p>

            {error && (
              <div role="alert" className="mt-5 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-2.5 text-sm font-medium text-left">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={sendLink}
              disabled={loading || cooldown > 0}
              className="mt-6 w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-60 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> Sending…
                </>
              ) : cooldown > 0 ? (
                `Resend in ${cooldown}s`
              ) : (
                'Resend email'
              )}
            </button>
            <button
              type="button"
              onClick={useDifferentEmail}
              className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-indigo-500/25 mb-4">
                <KeyRound size={24} strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl font-extrabold text-[color:var(--rm-ink)] tracking-tight">Reset password</h1>
              <p className="mt-2 text-slate-500 font-medium">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            {error && (
              <div role="alert" className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-2.5 text-sm font-medium">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                  Email address
                </label>
                <div className="relative group">
                  <Mail
                    className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                      emailValid ? 'text-emerald-500' : 'text-slate-400 group-focus-within:text-blue-500'
                    }`}
                    size={20}
                  />
                  <input
                    ref={emailRef}
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="you@example.com"
                    className={`w-full py-3.5 pl-12 pr-12 bg-[color:var(--rm-soft)] border-2 rounded-2xl text-[color:var(--rm-ink)] font-medium placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:outline-none focus:ring-4 transition-all ${
                      emailValid
                        ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/15'
                        : 'border-transparent focus:border-blue-500 focus:ring-blue-500/15'
                    }`}
                  />
                  {emailValid && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center" aria-hidden="true">
                      <Check size={13} strokeWidth={3.5} />
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98] disabled:opacity-70 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} /> Sending…
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}