import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import api from '../../utils/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8 bg-gray-50">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white shadow-xl rounded-2xl border border-gray-100">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-6 w-fit group"
        >
          <div className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 group-hover:bg-gray-200 transition-colors">
            <ArrowLeft size={16} />
          </div>
          Back to Login
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Reset Password
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Enter your email and we'll send you a reset link.
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
            <h3 className="text-lg font-bold text-green-900 mb-2">Check your email</h3>
            <p className="text-sm text-green-700">
              If an account exists for <strong>{email}</strong>, we've sent instructions to reset your password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={22} /> : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}