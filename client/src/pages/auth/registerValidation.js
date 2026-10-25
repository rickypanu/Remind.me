// Rules for the sign-up form. They mirror the server's, so a message appears before the request is sent.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 40;
export const USERNAME_ERROR = "Use 3-40 characters, with no spaces, quotes, angle brackets or ampersands.";
export const EMAIL_ERROR = "Enter a valid email like name@example.com";

/** 3-40 characters, no spaces, none of < > " ' ` & */
export function isUsernameValid(value) {
  const name = value.trim();
  return name.length >= USERNAME_MIN && name.length <= USERNAME_MAX && !/[\s<>"'`&]/.test(name);
}

export const isEmailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export const PASSWORD_CRITERIA = [
  { key: "length", label: "8+ characters", test: (p) => p.length >= 8 },
  { key: "uppercase", label: "Uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { key: "lowercase", label: "Lowercase letter", test: (p) => /[a-z]/.test(p) },
  { key: "number", label: "Number", test: (p) => /\d/.test(p) },
  { key: "special", label: "Special character (!@#$%^&*)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** `{ met: { length: true, ... }, metCount, valid, strength }` for one password. */
export function evaluatePassword(password) {
  const met = Object.fromEntries(PASSWORD_CRITERIA.map(({ key, test }) => [key, test(password)]));
  const metCount = Object.values(met).filter(Boolean).length;
  const strength =
    metCount <= 2
      ? { label: "Weak", bar: "bg-rose-400", text: "text-rose-700" }
      : metCount < PASSWORD_CRITERIA.length
        ? { label: "Almost there", bar: "bg-amber-400", text: "text-amber-700" }
        : { label: "Strong", bar: "bg-emerald-500", text: "text-emerald-700" };
  return { met, metCount, valid: metCount === PASSWORD_CRITERIA.length, strength };
}
