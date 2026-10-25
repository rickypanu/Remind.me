import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useResetPassword } from '../../hooks/useAuthMutations';
import FormField from '../../components/forms/FormField';
import ThemeToggle from '../../components/ThemeToggle';
import Logo from '../../components/Logo';
import usePageMeta from '../../utils/usePageMeta';
import notify from '../../utils/notify';
import { getErrorMessage } from '../../utils/errors';

export default function ResetPassword() {
  usePageMeta({ title: 'Reset password', description: 'Choose a new password for your RemindMe account.' });
  const navigate = useNavigate();
  // The emailed link looks like /reset-password#token=... The token is in the URL FRAGMENT, which browsers never
  // send to any server, so it cannot end up in server logs, proxies or Referer headers. Read it once, then remove
  // it from the address bar and history so it is not left behind for shoulder-surfers or browser sync.
  const [token] = useState(() => {
    const fragment = window.location.hash.replace(/^#/, '');
    return new URLSearchParams(fragment).get('token') || '';
  });
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  }, []);
  
  const [loading, setLoading] = useState(false);
  const resetPassword = useResetPassword();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // --- NEW: Password Strength Validation ---
    // Same rules the server enforces: 8-128 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;
    
    if (!passwordRegex.test(formData.password)) {
      return setError("Password must be 8-128 characters and contain an uppercase letter, a lowercase letter, a number, and a special character.");
    }

    // --- Check if passwords match ---
    if (formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      await resetPassword.mutateAsync({ token, new_password: formData.password });
      setSuccess(true);
      notify.success('Password updated. You can log in now.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        'Invalid or expired token. Please try requesting a new reset link.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="relative flex flex-col items-center justify-center gap-4 min-h-screen px-6 text-center bg-[color:var(--rm-page)]">
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-4">
          <Logo />
          <ThemeToggle />
        </div>
        <p role="alert" className="max-w-sm font-medium text-red-600">
          This reset link is missing its token. Please open the link from your email again, or request a new one.
        </p>
        <Link to="/forgot-password" className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen px-4 pt-24 pb-8 bg-[color:var(--rm-page)]">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4">
        <Logo />
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md p-6 sm:p-8 bg-white shadow-xl rounded-2xl border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Set New Password
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Please enter your new password below.
          </p>
        </div>

        {error && (
          <div id="reset-error" role="alert" className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center gap-2 text-sm font-medium">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="mb-6 p-6 rounded-xl bg-green-50 border border-green-100 text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-bold text-green-900 mb-2">Password Updated!</h3>
            <p className="text-sm text-green-700">
              Redirecting you to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate aria-label="Set a new password" className="space-y-5">
            <FormField
              id="new-password"
              name="password"
              label="New password"
              icon={Lock}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={handleChange}
              state={error ? "bad" : "neutral"}
              describedBy={error ? "reset-error" : undefined}
              hint="Must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character."
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 focus:outline-none focus-visible:text-blue-600"
                >
                  {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              }
            />

            <FormField
              id="confirm-new-password"
              name="confirmPassword"
              label="Confirm password"
              icon={Lock}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              state={error ? "bad" : "neutral"}
              describedBy={error ? "reset-error" : undefined}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-70 flex items-center justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={22} /> : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}