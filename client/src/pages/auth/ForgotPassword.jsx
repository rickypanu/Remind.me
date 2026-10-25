import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader2, AlertCircle, ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import { useForgotPassword } from '../../hooks/useAuthMutations';
import FormField from '../../components/forms/FormField';
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
  const forgotPassword = useForgotPassword();
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
      await forgotPassword.mutateAsync(emailTrim);
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
    <div className="rm-display relative flex items-center justify-center min-h-screen px-4 pt-24 pb-10 bg-gradient-to-b from-[color:var(--rm-hero-top)] to-[color:var(--rm-page)] overflow-hidden">

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4">
        <Logo />
        <ThemeToggle />
      </div>

      {/* Soft background glows */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-emerald-100/60 blur-3xl" />

      <div className="rm-rise relative w-full max-w-md p-6 sm:p-9 bg-white rounded-[2rem] border border-sky-100 shadow-[0_30px_80px_-30px_rgba(37,99,235,0.35)]">
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
            <p className="mt-2 text-xs text-slate-500">Can't see it? Check your spam folder.</p>

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
              <div id="forgot-error" role="alert" className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-2.5 text-sm font-medium">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <FormField
                id="email"
                label="Email address"
                icon={Mail}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                inputRef={emailRef}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                state={error ? 'bad' : emailValid ? 'good' : 'neutral'}
                describedBy={error ? 'forgot-error' : undefined}
              />

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