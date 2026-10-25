import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, LayoutDashboard, Loader2, Lock, Mail, User } from "lucide-react";
import FormField from "../../components/forms/FormField";
import useRegisterForm from "../../hooks/useRegisterForm";
import usePageMeta from "../../utils/usePageMeta";
import { routeMeta } from "../../seo/routes";
import AuthShell from "./AuthShell";
import PasswordChecklist from "./PasswordChecklist";
import RegisterSuccess from "./RegisterSuccess";

export default function Register() {
  usePageMeta(routeMeta("/register"));
  const navigate = useNavigate();
  const form = useRegisterForm();
  const { formData, fields, refs, password } = form;

  if (form.success) {
    return (
      <AuthShell>
        <RegisterSuccess />
      </AuthShell>
    );
  }

  const showHideButton = (
    <button
      type="button"
      onClick={form.toggleShowPassword}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:text-blue-600 transition-colors"
      aria-label={form.showPassword ? "Hide password" : "Show password"}
      aria-pressed={form.showPassword}
    >
      {form.showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
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
        <h1 className="text-3xl font-extrabold text-[color:var(--rm-ink)] tracking-tight">Create your account</h1>
        <p className="mt-2 text-slate-600 font-medium">
          Join Remind<span className="text-blue-600">Me</span> to conquer your deadlines.
        </p>
        <p className="mt-1 text-xs text-slate-500">Free. Takes about 30 seconds.</p>
      </div>

      {form.error && (
        <div role="alert" className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-2.5 text-sm font-medium">
          <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
          <span>{form.error}</span>
        </div>
      )}

      <form onSubmit={form.handleSubmit} noValidate aria-label="Create account" className="space-y-5">
        <FormField
          id="username"
          name="username"
          label="Username"
          icon={User}
          type="text"
          autoComplete="username"
          placeholder="Choose a username"
          inputRef={refs.username}
          value={formData.username}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          {...fields.username}
        />

        <FormField
          id="email"
          name="email"
          label="Email address"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          inputRef={refs.email}
          value={formData.email}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          {...fields.email}
        />

        <div className="space-y-1.5">
          <FormField
            id="password"
            name="password"
            label="Password"
            icon={Lock}
            type={form.showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Create a password"
            inputRef={refs.password}
            value={formData.password}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            onKeyUp={form.handleCaps}
            onKeyDown={form.handleCaps}
            trailing={showHideButton}
            {...fields.password}
          />
          {form.capsOn && (
            <p role="status" className="text-amber-700 text-xs font-medium flex items-center gap-1.5">
              <AlertCircle size={14} aria-hidden="true" /> Caps Lock is on
            </p>
          )}
          <PasswordChecklist evaluation={password} hasInput={formData.password.length > 0} />
        </div>

        <div className="space-y-1.5">
          <FormField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm password"
            icon={Lock}
            type={form.showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm your password"
            inputRef={refs.confirmPassword}
            value={formData.confirmPassword}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            {...fields.confirmPassword}
          />
          {form.showMatchSuccess && (
            <p role="status" className="text-emerald-700 text-xs font-medium flex items-center gap-1.5 mt-1.5">
              <CheckCircle size={14} aria-hidden="true" /> Passwords match
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={form.loading}
          className={`w-full py-4 px-4 mt-2 text-white font-bold rounded-full transition-all active:scale-[0.98] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 ${
            form.isFormValid
              ? "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
              : "bg-blue-600/80 hover:bg-blue-600"
          } disabled:opacity-70 disabled:cursor-not-allowed`}
        >
          {form.loading ? (
            <>
              <Loader2 className="animate-spin" size={20} aria-hidden="true" /> Creating account…
            </>
          ) : (
            "Create account"
          )}
        </button>
        {form.submitted && !form.isFormValid && !form.loading && (
          <p className="text-center text-xs font-medium text-rose-700" role="alert">
            Please fix the highlighted fields to continue.
          </p>
        )}
      </form>

      <p className="mt-4 text-center text-xs text-slate-600 leading-relaxed">
        By clicking Create account, you agree to our{" "}
        <Link to="/terms" className="text-blue-700 font-semibold hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/terms" className="text-blue-700 font-semibold hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <div className="mt-7 pt-6 border-t border-slate-100 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link to="/login" className="text-blue-700 font-bold hover:text-blue-800 hover:underline transition-colors">
          Log in
        </Link>
      </div>
    </AuthShell>
  );
}
