import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail,
  Lock,
  User,
  Loader2,
  CheckCircle,
  Circle,
  Check,
  AlertCircle,
  LayoutDashboard,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  XCircle,
} from "lucide-react";
import api from "../../utils/api";
import ThemeToggle from '../../components/ThemeToggle';
import Logo from '../../components/Logo';
import usePageMeta from '../../utils/usePageMeta';
import notify from '../../utils/notify';
import { getErrorMessage } from '../../utils/errors';


export default function Register() {
  usePageMeta({ title: 'Create your free account', description: 'Sign up for RemindMe free and get specific, daily and weekly reminders on Telegram and in your browser.' });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  // After a successful signup, send the user to login automatically
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => navigate("/login"), 3000);
    return () => clearTimeout(t);
  }, [success, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleBlur = (e) => {
    setTouched((t) => ({ ...t, [e.target.name]: true }));
    if (e.target.name === "password") setCapsOn(false);
  };

  const handleCaps = (e) => {
    if (e.getModifierState) setCapsOn(e.getModifierState("CapsLock"));
  };

  // --- Real-time Validation Logic ---
  const usernameTrim = formData.username.trim();
  const emailTrim = formData.email.trim();
  const usernameValid = usernameTrim.length >= 3 && !/\s/.test(usernameTrim);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTrim);

  const passwordCriteria = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /\d/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password),
  };

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  const passwordsMatch = formData.password === formData.confirmPassword;
  const showMatchError = formData.confirmPassword.length > 0 && !passwordsMatch;
  const showMatchSuccess = formData.confirmPassword.length > 0 && passwordsMatch && isPasswordValid;

  // Form is only valid if fields are valid, password meets criteria, and passwords match
  const isFormValid =
    usernameValid &&
    emailValid &&
    isPasswordValid &&
    formData.confirmPassword.length > 0 &&
    passwordsMatch;

  // Show a field's error only after the user has left it (or tried to submit)
  const show = (k) => touched[k] || submitted;
  const usernameBad = show("username") && formData.username.length > 0 && !usernameValid;
  const emailBad = show("email") && formData.email.length > 0 && !emailValid;
  const passwordBad = show("password") && formData.password.length > 0 && !isPasswordValid;

  // -------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setSubmitted(true);
    if (!isFormValid) {
      // Move focus to the first field that needs attention
      if (!usernameValid) usernameRef.current?.focus();
      else if (!emailValid) emailRef.current?.focus();
      else if (!isPasswordValid) passwordRef.current?.focus();
      else confirmRef.current?.focus();
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/auth/signup", {
        username: usernameTrim,
        email: emailTrim.toLowerCase(),
        password: formData.password,
      });

      setSuccess(true);
      notify.success('Account created. Redirecting you to log in.');
      setFormData({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      setShowPassword(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // --- UI-only helpers ---
  const metCount = Object.values(passwordCriteria).filter(Boolean).length;
  const strengthLabel = metCount <= 2 ? "Weak" : metCount < 5 ? "Almost there" : "Strong";
  const strengthColor = metCount <= 2 ? "bg-rose-400" : metCount < 5 ? "bg-amber-400" : "bg-emerald-500";
  const strengthText = metCount <= 2 ? "text-rose-500" : metCount < 5 ? "text-amber-600" : "text-emerald-600";

  const inputBase =
    "w-full py-3.5 pl-12 pr-12 bg-[color:var(--rm-soft)] border-2 rounded-2xl text-[color:var(--rm-ink)] font-medium placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:outline-none focus:ring-4 transition-all";
  const tone = {
    neutral: "border-transparent focus:border-blue-500 focus:ring-blue-500/15",
    good: "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/15",
    bad: "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15",
  };
  const iconBase = "absolute left-4 top-1/2 -translate-y-1/2 transition-colors";
  const iconTone = {
    neutral: "text-slate-400 group-focus-within:text-blue-500",
    good: "text-emerald-500",
    bad: "text-rose-500",
  };
  const usernameState = usernameBad ? "bad" : usernameValid ? "good" : "neutral";
  const emailState = emailBad ? "bad" : emailValid ? "good" : "neutral";
  const passwordState = passwordBad ? "bad" : isPasswordValid ? "good" : "neutral";
  const confirmState = showMatchError ? "bad" : showMatchSuccess ? "good" : "neutral";

  const tick = (
    <span className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center" aria-hidden="true">
      <Check size={13} strokeWidth={3.5} />
    </span>
  );

  const criteriaList = [
    { key: "length", label: "8+ characters" },
    { key: "uppercase", label: "Uppercase letter" },
    { key: "lowercase", label: "Lowercase letter" },
    { key: "number", label: "Number" },
    { key: "special", label: "Special character (!@#$%^&*)" },
  ];

  return (
    <div className="register-root relative flex items-center justify-center min-h-screen px-4 pt-24 pb-10 bg-gradient-to-b from-[color:var(--rm-hero-top)] to-[color:var(--rm-page)] overflow-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .register-root { font-family: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif; }
        @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes fill { from { width: 0; } to { width: 100%; } }
        .rise { animation: rise .45s ease-out both; }
        .fill { animation: fill 3s linear forwards; }
        @media (prefers-reduced-motion: reduce) { .rise, .fill { animation: none; } .fill { width: 100%; } }
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
        {success ? (
          /* Success state */
          <div className="text-center py-6" role="status">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
              <Check size={32} strokeWidth={3} />
            </div>
            <h1 className="text-3xl font-extrabold text-[color:var(--rm-ink)] tracking-tight">You're all set</h1>
            <p className="mt-2 text-slate-500 font-medium">Account created. Taking you to login…</p>
            <div className="mt-6 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="fill h-full rounded-full bg-emerald-500" />
            </div>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center justify-center gap-2 w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
            >
              Log in now <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <>
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
                Create your account
              </h1>
              <p className="mt-2 text-slate-500 font-medium">
                Join Remind<span className="text-blue-600">Me</span> to conquer your deadlines.
              </p>
              <p className="mt-1 text-xs text-slate-400">Free. Takes about 30 seconds.</p>
            </div>

            {/* Error message */}
            {error && (
              <div role="alert" className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-2.5 text-sm font-medium">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Username Field */}
              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-sm font-semibold text-slate-700">
                  Username
                </label>
                <div className="relative group">
                  <User className={`${iconBase} ${iconTone[usernameState]}`} size={20} />
                  <input
                    ref={usernameRef}
                    id="username"
                    type="text"
                    name="username"
                    autoComplete="username"
                    placeholder="Choose a username"
                    value={formData.username}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={usernameBad}
                    className={`${inputBase} ${tone[usernameState]}`}
                  />
                  {usernameValid && tick}
                </div>
                {usernameBad && (
                  <p className="text-rose-600 text-xs font-medium flex items-center gap-1.5">
                    <XCircle size={14} /> Use at least 3 characters, with no spaces.
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                  Email address
                </label>
                <div className="relative group">
                  <Mail className={`${iconBase} ${iconTone[emailState]}`} size={20} />
                  <input
                    ref={emailRef}
                    id="email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={emailBad}
                    className={`${inputBase} ${tone[emailState]}`}
                  />
                  {emailValid && tick}
                </div>
                {emailBad && (
                  <p className="text-rose-600 text-xs font-medium flex items-center gap-1.5">
                    <XCircle size={14} /> Enter a valid email like name@example.com
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative group">
                  <Lock className={`${iconBase} ${iconTone[passwordState]}`} size={20} />
                  <input
                    ref={passwordRef}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyUp={handleCaps}
                    onKeyDown={handleCaps}
                    aria-invalid={passwordBad}
                    className={`${inputBase} ${tone[passwordState]}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:text-blue-600 transition-colors"
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

                {/* Strength bar */}
                {formData.password.length > 0 && (
                  <div className="pt-1.5">
                    <div className="flex gap-1.5" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${n <= metCount ? strengthColor : "bg-slate-200"}`}
                        />
                      ))}
                    </div>
                    <p aria-live="polite" className={`mt-1.5 text-xs font-semibold ${strengthText}`}>{strengthLabel}</p>
                  </div>
                )}

                {/* Live Password Checklist */}
                <ul className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-2">
                  {criteriaList.map(({ key, label }) => {
                    const met = passwordCriteria[key];
                    return (
                      <li
                        key={key}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                          met ? "text-emerald-600" : "text-slate-400"
                        } ${key === "special" ? "sm:col-span-2" : ""}`}
                      >
                        {met ? (
                          <CheckCircle size={15} className="text-emerald-500" />
                        ) : (
                          <Circle size={15} className="text-slate-300" />
                        )}
                        {label}
                        <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700">
                  Confirm password
                </label>
                <div className="relative group">
                  <Lock className={`${iconBase} ${iconTone[confirmState]}`} size={20} />
                  <input
                    ref={confirmRef}
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={showMatchError}
                    className={`${inputBase} ${tone[confirmState]}`}
                  />
                  {showMatchSuccess && tick}
                </div>

                {/* Real-time Match Feedback */}
                {showMatchError && (
                  <p className="text-rose-600 text-xs font-medium flex items-center gap-1.5 mt-1.5">
                    <XCircle size={14} /> Passwords do not match
                  </p>
                )}
                {showMatchSuccess && (
                  <p className="text-emerald-600 text-xs font-medium flex items-center gap-1.5 mt-1.5">
                    <CheckCircle size={14} /> Passwords match
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 px-4 mt-2 text-white font-bold rounded-full transition-all active:scale-[0.98] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 ${
                  isFormValid
                    ? "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                    : "bg-blue-400 hover:bg-blue-500"
                } disabled:opacity-70 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} /> Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </button>
              {submitted && !isFormValid && !loading && (
                <p className="text-center text-xs font-medium text-rose-600" role="alert">
                  Please fix the highlighted fields to continue.
                </p>
              )}
            </form>

            <div className="mt-4 text-center text-xs text-slate-500 leading-relaxed">
              By clicking Create account, you agree to our{" "}
              <Link to="/terms" className="text-blue-600 font-semibold hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/terms" className="text-blue-600 font-semibold hover:underline">
                Privacy Policy
              </Link>
              .
            </div>

            {/* Redirect to Login */}
            <div className="mt-7 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-blue-600 font-bold hover:text-blue-700 hover:underline transition-colors"
              >
                Log in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}