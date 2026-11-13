/** Languages the interface can be shown in. English is the source text; anything not translated stays English. */
export const LANGUAGES = [
  { code: "en", label: "English", english: "English", ready: true },
  { code: "hi", label: "हिन्दी", english: "Hindi", ready: true },
  { code: "hinglish", label: "Hinglish", english: "Hinglish", ready: true },
  { code: "bn", label: "বাংলা", english: "Bengali", ready: false },
  { code: "as", label: "অসমীয়া", english: "Assamese", ready: false },
  { code: "mr", label: "मराठी", english: "Marathi", ready: false },
  { code: "gu", label: "ગુજરાતી", english: "Gujarati", ready: false },
  { code: "pa", label: "ਪੰਜਾਬੀ", english: "Punjabi", ready: false },
  { code: "ta", label: "தமிழ்", english: "Tamil", ready: false },
  { code: "te", label: "తెలుగు", english: "Telugu", ready: false },
  { code: "kn", label: "ಕನ್ನಡ", english: "Kannada", ready: false },
  { code: "ml", label: "മലയാളം", english: "Malayalam", ready: false },
  { code: "or", label: "ଓଡ଼ିଆ", english: "Odia", ready: false },
  { code: "ur", label: "اردو", english: "Urdu", dir: "rtl", ready: false },
];

export const LANG_KEY = "deadline-lang";
// A language is listed in the picker only once its whole-site translation file is complete (ready: true).
export const PICKER_LANGUAGES = LANGUAGES.filter((l) => l.ready);
export const CODES = PICKER_LANGUAGES.map((l) => l.code);
// <html lang> wants real BCP-47 tags; "hinglish" is Hindi written in Latin letters.
export const htmlLang = (code) => (code === "hinglish" ? "hi-Latn" : code);

const LOCALES = { hinglish: "en-IN", hi: "hi-IN", bn: "bn-IN", mr: "mr-IN", gu: "gu-IN", pa: "pa-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN", or: "or-IN", ur: "ur-IN", as: "as-IN" };
/** Locale used for dates and numbers in the chosen language. */
export const dateLocale = (code) => LOCALES[code] || "en-US";
