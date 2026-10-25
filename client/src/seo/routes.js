// Single source of truth for the metadata of every PUBLIC page (findings X1-X3).
// Used in two places, so they can never disagree:
//   * the pages, through usePageMeta(routeMeta("/about")), which keeps the tab title right after navigation;
//   * scripts/prerender.mjs, which writes the same tags into static HTML at build time, so crawlers and link
//     previews (LinkedIn, WhatsApp, Slack ...), which do not run JavaScript, see the right card.
// Plain ES module with no React and no Vite-only imports, so Node can load it.
import { FAQS } from "../data/faqs.data.js";

export const SITE_NAME = "RemindMe";
export const OG_IMAGE = { path: "/og-image.png", width: 1200, height: 630, alt: "RemindMe: specific, daily and weekly reminders" };

const HOME_TITLE = "RemindMe: Specific, Daily & Weekly Reminders";
const HOME_DESCRIPTION =
  "RemindMe sends specific, daily and weekly reminders to Telegram and your browser. Type or speak a task, try it free without signing up, and never miss a deadline or habit again.";

const softwareApplication = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Any (web browser, installable as an app)",
  description: HOME_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const faqPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.steps ? `${faq.answer} ${faq.steps.join(" ")}` : faq.answer,
    },
  })),
};

/** Pages search engines may index. `path` is also the sitemap entry and the folder prerendered at build time. */
export const PUBLIC_ROUTES = {
  "/": { fullTitle: HOME_TITLE, description: HOME_DESCRIPTION, jsonLd: [softwareApplication], priority: "1.0" },
  "/about": {
    title: "About",
    description:
      "About RemindMe: a reminder app for specific, daily and weekly reminders with Magic Add AI, Telegram and browser notifications, and encrypted private reminders.",
    priority: "0.6",
  },
  "/faqs": {
    title: "FAQs & Help",
    description:
      "Answers about RemindMe: daily, weekly and one-time reminders, Magic Add, Telegram and browser notifications, privacy and your account.",
    jsonLd: [faqPage],
    priority: "0.7",
  },
  "/terms": {
    title: "Terms of Service & Privacy Policy",
    description:
      "Read the RemindMe Terms of Service and Privacy Policy: how your reminders are encrypted, which notification channels we use, and how to delete your data.",
    priority: "0.3",
  },
  "/login": {
    title: "Log in",
    description: "Log in to RemindMe to see your reminders and manage daily, weekly and one-time alerts.",
    priority: "0.5",
  },
  "/register": {
    title: "Create your free account",
    description: "Sign up for RemindMe free and get specific, daily and weekly reminders on Telegram and in your browser.",
    priority: "0.8",
  },
};

/** What the page <title> should be for a meta object. */
export const fullTitleOf = ({ fullTitle, title }) => fullTitle || (title ? `${title} | ${SITE_NAME}` : SITE_NAME);

/** Meta for a public path (throws on a typo, so a wrong path fails in tests and the build, not in production). */
export function routeMeta(path) {
  const meta = PUBLIC_ROUTES[path];
  if (!meta) throw new Error(`No SEO metadata registered for ${path}`);
  return { ...meta, path };
}

/** Joins the site origin and a path without doubling slashes. `origin` has no trailing slash. */
export const absoluteUrl = (origin, path) => `${origin.replace(/\/+$/, "")}${path === "/" ? "/" : path}`;
