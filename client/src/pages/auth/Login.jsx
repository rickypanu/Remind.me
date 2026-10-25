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
import { useLogin } from "../../hooks/useAuthMutations";
import { isLoggedIn } from "../../utils/auth";
import FormField from "../../components/forms/FormField";
import AuthShell from "./AuthShell";
import usePageMeta from '../../utils/usePageMeta';
import { routeMeta } from "../../seo/routes";
import notify from '../../utils/notify';
import { getErrorMessage } from '../../utils/errors';


export default function Login() {
  usePageMeta(routeMeta("/login"));
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const login = useLogin();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Check for existing token on mount
  useEffect(() => {
    if (isLoggedIn()) {
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
      // Stores the short-lived access token and the rotating refresh token (the API client renews the former silently)
      await login.mutateAsync({ email, password: formData.password });
      notify.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fieldState = error ? "bad" : "neutral";

  const showHideButton = (
    <button
      type="button"
      onClick={() => setShowPassword((value) => !value)}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 focus:outline-none focus-visible:text-blue-600 transition-colors"
      aria-label={showPassword ? "Hide password" : "Show password"}
      aria-pressed={showPassword}
    >
      {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
    </button>
  );

  return (
    <AuthShell>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors mb-6 w-fit group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
      >
        <span className="p-1.5 rounded-lg bg-[color:var(--rm-soft)] group-hover:bg-blue-100 transition-colors">
          <ArrowLeft size={16} aria-hidden="true" />
        </span>
        Back
      </button>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-indigo-500/25 mb-4">
          <LayoutDashboard size={24} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-extrabold text-[color:var(--rm-ink)] tracking-tight">Welcome back</h1>
        <p className="mt-2 text-slate-600 font-medium">
          Sign in to <span className="text-slate-800 font-extrabold">Remind</span>
          <span className="text-blue-600 font-extrabold">Me</span> and get things done.
        </p>
      </div>

      {error && (
        <div
          id="login-error"
          role="alert"
          className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-2.5 text-sm font-medium"
        >
          <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate aria-label="Log in" className="space-y-5">
        <FormField
          id="email"
          name="email"
          label="Email address"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          inputRef={emailRef}
          value={formData.email}
          onChange={handleChange}
          state={fieldState}
          describedBy={error ? "login-error" : undefined}
          className="pr-4"
        />

        <div className="space-y-1.5">
          <FormField
            id="password"
            name="password"
            label="Password"
            icon={Lock}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            inputRef={passwordRef}
            value={formData.password}
            onChange={handleChange}
            onKeyUp={handleCaps}
            onKeyDown={handleCaps}
            onBlur={() => setCapsOn(false)}
            state={fieldState}
            describedBy={error ? "login-error" : undefined}
            trailing={showHideButton}
          />
          {capsOn && (
            <p role="status" className="text-amber-700 text-xs font-medium flex items-center gap-1.5">
              <AlertCircle size={14} aria-hidden="true" /> Caps Lock is on
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98] disabled:opacity-70 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} aria-hidden="true" /> Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <div className="flex justify-end mt-5">
        <Link to="/forgot-password" className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline transition-colors">
          Forgot password?
        </Link>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 text-center text-sm text-slate-600">
        Don't have an account?{" "}
        <Link to="/register" className="text-blue-700 font-bold hover:text-blue-800 hover:underline transition-colors">
          Sign up
        </Link>
      </div>
    </AuthShell>
  );
}
