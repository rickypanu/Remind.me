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

  // --- Password Strength Logic ---
  const calculateStrength = (pass) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 8) score += 1;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const passwordStrength = calculateStrength(formData.password);

  const getStrengthLabel = (score) => {
    switch (score) {
      case 1:
        return "Weak";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Strong";
      default:
        return "";
    }
  };

  const getStrengthColor = (score, index) => {
    if (score < index) return "bg-gray-200";
    switch (score) {
      case 1:
        return "bg-red-500";
      case 2:
        return "bg-yellow-400";
      case 3:
        return "bg-blue-500";
      case 4:
        return "bg-green-500";
      default:
        return "bg-gray-200";
    }
  };
  // -------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side validation for matching passwords
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

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
          "Something went wrong. Please check your connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white shadow-xl rounded-2xl border border-gray-100">
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
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
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
                className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 focus:outline-none transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {formData.password.length > 0 && (
              <div className="pt-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((index) => (
                    <div
                      key={index}
                      className={`h-1.5 w-full rounded-full transition-colors duration-300 ${getStrengthColor(passwordStrength, index)}`}
                    />
                  ))}
                </div>
                <p className="text-xs font-medium text-gray-500 mt-1.5 text-right">
                  {getStrengthLabel(passwordStrength)}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-semibold text-gray-700"
            >
              Confirm Password
            </label>
            <div className="relative group">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
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
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
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
