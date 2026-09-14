import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail,
  Lock,
  User,
  Loader2,
  CheckCircle,
  AlertCircle,
  LayoutDashboard,
  Eye,
  EyeOff,
  ArrowLeft,
  XCircle,
} from "lucide-react";
import api from "../../utils/api";

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

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

  // --- Real-time Password Validation Logic ---
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
  const showMatchSuccess = formData.confirmPassword.length > 0 && passwordsMatch;

  // Form is only valid if fields are filled, password meets criteria, and passwords match
  const isFormValid =
    formData.username.trim() !== "" &&
    formData.email.trim() !== "" &&
    isPasswordValid &&
    passwordsMatch;

  // -------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isFormValid) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/auth/signup", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      setSuccess("Account created! You can now log in.");
      setFormData({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      setShowPassword(false);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Something went wrong. Please check your connection."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8 bg-gray-50">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white shadow-xl rounded-2xl border border-gray-100">
        
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-6 w-fit group"
        >
          <div className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 group-hover:bg-gray-200 transition-colors">
            <ArrowLeft size={16} />
          </div>
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <LayoutDashboard
            className="text-blue-600 inline-block mb-2"
            size={32}
          />
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Remind<span className="text-blue-600">Me</span>
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Join to conquer your deadlines.
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center gap-2 text-sm font-medium">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-100 text-green-700 flex items-center gap-2 text-sm font-medium">
            <CheckCircle size={18} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="block text-sm font-semibold text-gray-700"
            >
              Username
            </label>
            <div className="relative group">
              <User
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                size={20}
              />
              <input
                id="username"
                type="text"
                name="username"
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-gray-700"
            >
              Email Address
            </label>
            <div className="relative group">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                size={20}
              />
              <input
                id="email"
                type="email"
                name="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-gray-700"
            >
              Password
            </label>
            <div className="relative group">
              <Lock
                className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                  isPasswordValid ? "text-green-500" : "text-gray-400 group-focus-within:text-blue-500"
                }`}
                size={20}
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                required
                className={`w-full pl-12 pr-12 py-3.5 bg-gray-50 border rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-4 transition-all ${
                  isPasswordValid 
                    ? "border-green-500 focus:border-green-500 focus:ring-green-500/10" 
                    : "border-gray-200 focus:border-blue-500 focus:ring-blue-500/10"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Live Password Checklist */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${passwordCriteria.length ? "text-green-600" : "text-gray-400"}`}>
                <CheckCircle size={14} className={passwordCriteria.length ? "text-green-500" : "text-gray-300"} />
                8+ characters
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${passwordCriteria.uppercase ? "text-green-600" : "text-gray-400"}`}>
                <CheckCircle size={14} className={passwordCriteria.uppercase ? "text-green-500" : "text-gray-300"} />
                Uppercase letter
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${passwordCriteria.lowercase ? "text-green-600" : "text-gray-400"}`}>
                <CheckCircle size={14} className={passwordCriteria.lowercase ? "text-green-500" : "text-gray-300"} />
                Lowercase letter
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${passwordCriteria.number ? "text-green-600" : "text-gray-400"}`}>
                <CheckCircle size={14} className={passwordCriteria.number ? "text-green-500" : "text-gray-300"} />
                Number
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${passwordCriteria.special ? "text-green-600" : "text-gray-400"} sm:col-span-2`}>
                <CheckCircle size={14} className={passwordCriteria.special ? "text-green-500" : "text-gray-300"} />
                Special character (!@#$%^&*)
              </div>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-1.5 pt-2">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-semibold text-gray-700"
            >
              Confirm Password
            </label>
            <div className="relative group">
              <Lock
                className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                  showMatchSuccess ? "text-green-500" : showMatchError ? "text-red-500" : "text-gray-400 group-focus-within:text-blue-500"
                }`}
                size={20}
              />
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className={`w-full pl-12 pr-4 py-3.5 bg-gray-50 border rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-4 transition-all ${
                  showMatchSuccess
                    ? "border-green-500 focus:border-green-500 focus:ring-green-500/10"
                    : showMatchError
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                    : "border-gray-200 focus:border-blue-500 focus:ring-blue-500/10"
                }`}
              />
            </div>
            
            {/* Real-time Match Feedback */}
            {showMatchError && (
              <p className="text-red-500 text-xs font-medium flex items-center gap-1.5 mt-1.5">
                <XCircle size={14} /> Passwords do not match
              </p>
            )}
            {showMatchSuccess && (
              <p className="text-green-600 text-xs font-medium flex items-center gap-1.5 mt-1.5">
                <CheckCircle size={14} /> Passwords match
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full py-3.5 px-4 mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={22} />
            ) : (
              "Create Account"
            )}
          </button>
        </form>
        
        <div className="mt-4 text-center text-xs text-gray-500">
          By clicking Create Account, you agree to our{" "}
          <Link to="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/terms" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </div>

        {/* Redirect to Login */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-blue-600 font-bold hover:text-blue-700 hover:underline transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}