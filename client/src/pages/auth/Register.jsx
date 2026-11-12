import React from "react";
import { LogoMark } from "../../components/Logo";
import { useNavigate, Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import FormField from "../../components/forms/FormField";
import useRegisterForm from "../../hooks/useRegisterForm";
import usePageMeta from "../../utils/usePageMeta";
import { routeMeta } from "../../seo/routes";
import AuthShell from "./AuthShell";
import PasswordChecklist from "./PasswordChecklist";
import RegisterSuccess from "./RegisterSuccess";
import { useI18n } from "../../i18n/index.jsx";

export default function Register() {
  const { t } = useI18n();
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
      aria-label={form.showPassword ? t("Hide password") : t("Show password")}
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
        {t("Back")}
      </button>

      <div className="text-center mb-8">
        <LogoMark size={52} className="inline-block rounded-2xl shadow-md shadow-violet-500/25 mb-4" />
        <h1 className="text-3xl font-extrabold text-[color:var(--rm-ink)] tracking-tight">{t("Create your account")}</h1>
        <p className="mt-2 text-slate-600 font-medium">
          {t("Join Deadline and conquer your deadlines.")}
        </p>
        <p className="mt-1 text-xs text-slate-500">{t("Free. Takes about 30 seconds.")}</p>
      </div>

      {form.error && (
        <div role="alert" className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-2.5 text-sm font-medium">
          <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
          <span>{form.error}</span>
        </div>
      )}

      <form onSubmit={form.handleSubmit} noValidate aria-label={t("Create account")} className="space-y-5">
        <FormField
          id="username"
          name="username"
          label={t("Username")}
          icon={User}
          type="text"
          autoComplete="username"
          placeholder={t("Choose a username")}
          inputRef={refs.username}
          value={formData.username}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          {...fields.username}
        />

        <FormField
          id="email"
          name="email"
          label={t("Email address")}
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
            label={t("Password")}
            icon={Lock}
            type={form.showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder={t("Create a password")}
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
            label={t("Confirm password")}
            icon={Lock}
            type={form.showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder={t("Confirm your password")}
            inputRef={refs.confirmPassword}
            value={formData.confirmPassword}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            {...fields.confirmPassword}
          />
          {form.showMatchSuccess && (
            <p role="status" className="text-emerald-700 text-xs font-medium flex items-center gap-1.5 mt-1.5">
              <CheckCircle size={14} aria-hidden="true" /> {t("Passwords match")}
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
              <Loader2 className="animate-spin" size={20} aria-hidden="true" /> {t("Creating account…")}
            </>
          ) : (
            t("Create account")
          )}
        </button>
        {form.submitted && !form.isFormValid && !form.loading && (
          <p className="text-center text-xs font-medium text-rose-700" role="alert">
            {t("Please fix the highlighted fields to continue.")}
          </p>
        )}
      </form>

      <p className="mt-4 text-center text-xs text-slate-600 leading-relaxed">
        {t("By clicking Create account, you agree to our")}{" "}
        <Link to="/terms" className="text-blue-700 font-semibold hover:underline">
          {t("Terms of Service")}
        </Link>{" "}
        {t("and")}{" "}
        <Link to="/terms" className="text-blue-700 font-semibold hover:underline">
          {t("Privacy Policy")}
        </Link>
        .
      </p>

      <div className="mt-7 pt-6 border-t border-slate-100 text-center text-sm text-slate-600">
        {t("Already have an account?")}{" "}
        <Link to="/login" className="text-blue-700 font-bold hover:text-blue-800 hover:underline transition-colors">
          {t("Log in")}
        </Link>
      </div>
    </AuthShell>
  );
}
