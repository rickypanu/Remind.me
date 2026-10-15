import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import api from "../../utils/api";
import ThemeToggle from '../../components/ThemeToggle';
import Logo from '../../components/Logo';
import usePageMeta from '../../utils/usePageMeta';
import notify from '../../utils/notify';
import { getErrorMessage } from '../../utils/errors';


export default function Login() {
  usePageMeta({ title: 'Log in', description: 'Log in to RemindMe to see your reminders and manage daily, weekly and one-time alerts.' });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleCaps = (e) => {
    if (e.getModifierState) setCapsOn(e.getModifierState("CapsLock"));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const email = formData.email.trim();

    // Send focus to the first empty field instead of a browser popup
    if (!email) {
      setError("Enter your email to sign in.");
      emailRef.current?.focus();
      return;
    }
    if (!formData.password) {
      setError("Enter your password to sign in.");
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      // Backend expects 'username' for the login email/username field
      params.append("username", email);
      params.append("password", formData.password);

      const response = await api.post("/auth/login", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = response.data?.access_token;
      if (!token) throw new Error("No token returned");

      localStorage.setItem("token", token);
      notify.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full py-3.5 pl-12 bg-[color:var(--rm-soft)] border-2 border-transparent rounded-2xl text-[color:var(--rm-ink)] font-medium placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition-all";
  const iconBase =
    "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors";

  return (
    <div className="login-root relative flex items-center justify-center min-h-screen px-4 pt-24 pb-10 bg-gradient-to-b from-[color:var(--rm-hero-top)] to-[color:var(--rm-page)] overflow-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .login-root { font-family: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif; }
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
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-6 w-fit group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
        >
          <span className="p-1.5 rounded-lg bg-[color:var(--rm-soft)] group-hover:bg-blue-100 transition-colors">
            <ArrowLeft size={16} />
          </span>
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-indigo-500/25 mb-4">
            <LayoutDashboard size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-extrabold text-[color:var(--rm-ink)] tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-slate-500 font-medium">
            Sign in to{" "}
            <span className="text-slate-800 font-extrabold">Remind</span>
            <span className="text-blue-600 font-extrabold">Me</span> and get
            things done.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-2.5 text-sm font-medium"
          >
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Email Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-slate-700"
            >
              Email address
            </label>
            <div className="relative group">
              <Mail className={iconBase} size={20} />
              <input
                ref={emailRef}
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                className={`${inputBase} pr-4`}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700"
              >
                Password
              </label>
            </div>
            <div className="relative group">
              <Lock className={iconBase} size={20} />
              <input
                ref={passwordRef}
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                onKeyUp={handleCaps}
                onKeyDown={handleCaps}
                onBlur={() => setCapsOn(false)}
                className={`${inputBase} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 focus:outline-none focus-visible:text-blue-600 transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {capsOn && (
              <p className="text-amber-600 text-xs font-medium flex items-center gap-1.5">
                <AlertCircle size={14} /> Caps Lock is on
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98] disabled:opacity-70 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Forgot password */}
        <div className="flex justify-end mt-5">
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Redirect to Register */}
        <div className="mt-3 pt-3 border-t border-slate-100 text-center text-sm text-slate-500">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-blue-600 font-bold hover:text-blue-700 hover:underline transition-colors"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
