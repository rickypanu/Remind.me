/** Languages the interface can be shown in. English is the source text; anything not translated stays English. */
export const LANGUAGES = [
  { code: "en", label: "English", english: "English" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
  { code: "hinglish", label: "Hinglish", english: "Hinglish" },
  { code: "bn", label: "বাংলা", english: "Bengali" },
  { code: "mr", label: "मराठी", english: "Marathi" },
  { code: "gu", label: "ગુજરાતી", english: "Gujarati" },
  { code: "pa", label: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { code: "ta", label: "தமிழ்", english: "Tamil" },
  { code: "te", label: "తెలుగు", english: "Telugu" },
  { code: "kn", label: "ಕನ್ನಡ", english: "Kannada" },
  { code: "ml", label: "മലയാളം", english: "Malayalam" },
  { code: "or", label: "ଓଡ଼ିଆ", english: "Odia" },
  { code: "ur", label: "اردو", english: "Urdu", dir: "rtl" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "fr", label: "Français", english: "French" },
  { code: "de", label: "Deutsch", english: "German" },
  { code: "pt", label: "Português", english: "Portuguese" },
  { code: "ar", label: "العربية", english: "Arabic", dir: "rtl" },
];

export const LANG_KEY = "deadline-lang";
export const CODES = LANGUAGES.map((l) => l.code);
// <html lang> wants real BCP-47 tags; "hinglish" is Hindi written in Latin letters.
export const htmlLang = (code) => (code === "hinglish" ? "hi-Latn" : code);

const LOCALES = { hinglish: "en-IN", hi: "hi-IN", bn: "bn-IN", mr: "mr-IN", gu: "gu-IN", pa: "pa-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN", or: "or-IN", ur: "ur-IN", es: "es", fr: "fr", de: "de", pt: "pt", ar: "ar" };
/** Locale used for dates and numbers in the chosen language. */
export const dateLocale = (code) => LOCALES[code] || "en-US";
