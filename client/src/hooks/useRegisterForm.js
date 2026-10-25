import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSignup } from "./useAuthMutations";
import { EMAIL_ERROR, USERNAME_ERROR, evaluatePassword, isEmailValid, isUsernameValid } from "../pages/auth/registerValidation";
import { isLoggedIn } from "../utils/auth";
import { getErrorMessage } from "../utils/errors";
import notify from "../utils/notify";

const EMPTY = { username: "", email: "", password: "", confirmPassword: "" };
const REDIRECT_AFTER_MS = 3000;

/** All state and rules of the sign-up page, so the page itself only lays things out. */
export default function useRegisterForm() {
  const navigate = useNavigate();
  const signup = useSignup();

  const [formData, setFormData] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const refs = { username: useRef(null), email: useRef(null), password: useRef(null), confirmPassword: useRef(null) };

  // Already signed in: nothing to do here.
  useEffect(() => {
    if (isLoggedIn()) navigate("/dashboard", { replace: true });
  }, [navigate]);

  // After a successful signup, send the user to login automatically.
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => navigate("/login"), REDIRECT_AFTER_MS);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const username = formData.username.trim();
  const email = formData.email.trim();
  const usernameValid = isUsernameValid(username);
  const emailValid = isEmailValid(email);
  const password = evaluatePassword(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword;
  const hasConfirm = formData.confirmPassword.length > 0;
  const isFormValid = usernameValid && emailValid && password.valid && hasConfirm && passwordsMatch;

  // A field's error appears only after the user has left it (or tried to submit).
  const shown = (name) => touched[name] || submitted;
  const stateOf = (bad, good) => (bad ? "bad" : good ? "good" : "neutral");
  const fields = {
    username: {
      state: stateOf(shown("username") && formData.username.length > 0 && !usernameValid, usernameValid),
      error: USERNAME_ERROR,
    },
    email: {
      state: stateOf(shown("email") && formData.email.length > 0 && !emailValid, emailValid),
      error: EMAIL_ERROR,
    },
    password: {
      state: stateOf(shown("password") && formData.password.length > 0 && !password.valid, password.valid),
      error: "Add the missing requirements listed below.",
    },
    confirmPassword: {
      state: stateOf(hasConfirm && !passwordsMatch, hasConfirm && passwordsMatch && password.valid),
      error: "Passwords do not match",
    },
  };

  const handleChange = (event) => {
    setFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setError("");
  };
  const handleBlur = (event) => {
    setTouched((previous) => ({ ...previous, [event.target.name]: true }));
    if (event.target.name === "password") setCapsOn(false);
  };
  const handleCaps = (event) => {
    if (event.getModifierState) setCapsOn(event.getModifierState("CapsLock"));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (signup.isPending) return;

    setSubmitted(true);
    if (!isFormValid) {
      // Move focus to the first field that needs attention.
      const first = !usernameValid ? "username" : !emailValid ? "email" : !password.valid ? "password" : "confirmPassword";
      refs[first].current?.focus();
      return;
    }

    setError("");
    try {
      await signup.mutateAsync({ username, email: email.toLowerCase(), password: formData.password });
      setSuccess(true);
      notify.success("Account created. Redirecting you to log in.");
      setFormData(EMPTY);
      setShowPassword(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return {
    formData,
    fields,
    refs,
    password,
    showMatchError: fields.confirmPassword.state === "bad",
    showMatchSuccess: fields.confirmPassword.state === "good",
    showPassword,
    toggleShowPassword: () => setShowPassword((value) => !value),
    capsOn,
    error,
    success,
    submitted,
    loading: signup.isPending,
    isFormValid,
    handleChange,
    handleBlur,
    handleCaps,
    handleSubmit,
  };
}
