import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import api from '../../utils/api';
import ThemeToggle from '../../components/ThemeToggle';
import Logo from '../../components/Logo';
import usePageMeta from '../../utils/usePageMeta';
import notify from '../../utils/notify';
import { getErrorMessage } from '../../utils/errors';

export default function ResetPassword() {
  usePageMeta({ title: 'Reset password', description: 'Choose a new password for your RemindMe account.' });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(false);
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
    // Regex checks for: >=8 chars, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    
    if (!passwordRegex.test(formData.password)) {
      return setError("Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, and a number.");
    }

    // --- Check if passwords match ---
    if (formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token: token,
        new_password: formData.password
      });
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
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center gap-2 text-sm font-medium">
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
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                New Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {/* Optional: Helpful hint text below the input */}
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                Confirm Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
            </div>

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