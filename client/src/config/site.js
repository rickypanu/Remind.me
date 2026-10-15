// Single source of truth for contact details and links. Change them here and every page updates.
export const SITE = {
  name: "RemindMe",
  tagline: "Specific, daily and weekly reminders delivered to Telegram and your browser.",
  supportEmail: "rickypanu2005@gmail.com",
  // Add a number in international format (e.g. "+919876543210") to show a tap-to-call link in the footer.
  // Leave empty to hide it: no placeholder number is ever shown.
  supportPhone: "",
  repoUrl: "https://github.com/rickypanu/Remind.me",
};

export const mailto = (subject) =>
  `mailto:${SITE.supportEmail}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;

// "+91 98765 43210" -> "tel:+919876543210"
export const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;
