// Lets quick add understand reminders typed or spoken in Indian languages (Hindi, Marathi, Bengali, Assamese, Gujarati,
// Punjabi, Tamil, Telugu, Kannada, Malayalam, Odia, Urdu). The few date / time words are turned into the English words
// the parser already knows; everything else (the title) is left exactly as the person wrote it.

// Each entry: [English word the parser understands, ...native spellings]
const GROUPS = {
  today: 'today', tomorrow: 'tomorrow', after2: 'day after tomorrow',
  morning: 'morning', noon: 'afternoon', evening: 'evening', night: 'night',
  baje: 'baje', daily: 'every day', weekly: 'every week', min: 'min', hour: 'hours', baad: 'baad',
  mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday',
};

// suffix = true for languages that glue endings onto words (Tamil, Telugu, Kannada, Malayalam)
const SETS = [
  { // Hindi + Marathi (Devanagari)
    words: {
      today: ['आज'], tomorrow: ['कल', 'उद्या'], after2: ['परसों', 'परसो', 'परवा'],
      morning: ['सुबह', 'सवेरे', 'सकाळी', 'सकाळ'], noon: ['दोपहर', 'दुपारी'], evening: ['शाम', 'संध्याकाळी', 'संध्याकाळ'], night: ['रात्री', 'रात'],
      baje: ['बजे', 'वाजता', 'वाजले'], daily: ['हर दिन', 'हर रोज़', 'हर रोज', 'रोज़ाना', 'रोजाना', 'रोज़', 'रोज', 'दररोज', 'रोज'], weekly: ['हर हफ्ते', 'हर सप्ताह', 'दर आठवड्याला', 'दर आठवड्यात'],
      min: ['मिनट', 'मिनिटांनी', 'मिनिटांत', 'मिनिटे', 'मिनिट'], hour: ['घंटे', 'घंटा', 'घण्टे', 'तासांनी', 'तास'], baad: ['बाद', 'में', 'नंतर'],
      mon: ['सोमवार'], tue: ['मंगलवार', 'मंगळवार'], wed: ['बुधवार'], thu: ['गुरुवार', 'बृहस्पतिवार', 'वीरवार'], fri: ['शुक्रवार'], sat: ['शनिवार'], sun: ['रविवार', 'इतवार'],
    },
  },
  { // Bengali
    words: {
      today: ['আজ'], tomorrow: ['কাল'], after2: ['পরশু'], morning: ['সকালে', 'সকাল'], noon: ['দুপুরে', 'দুপুর'], evening: ['সন্ধ্যায়', 'সন্ধ্যা', 'বিকেলে', 'বিকেল'], night: ['রাতে', 'রাত'],
      baje: ['টায়', 'টার'], daily: ['প্রতিদিন', 'রোজ'], weekly: ['প্রতি সপ্তাহে', 'প্রতি সপ্তাহ'], min: ['মিনিট'], hour: ['ঘণ্টা', 'ঘন্টা'], baad: ['পরে', 'বাদে'],
      mon: ['সোমবার'], tue: ['মঙ্গলবার'], wed: ['বুধবার'], thu: ['বৃহস্পতিবার'], fri: ['শুক্রবার'], sat: ['শনিবার'], sun: ['রবিবার'],
    },
  },
  { // Assamese
    words: {
      today: ['আজি'], tomorrow: ['কালি'], after2: ['পৰহি'], morning: ['ৰাতিপুৱা'], noon: ['দুপৰীয়া'], evening: ['গধূলি', 'সন্ধিয়া'], night: ['ৰাতি'],
      baje: ['বজাত', 'বজে'], daily: ['প্ৰতিদিনে', 'প্ৰতিদিন'], weekly: ['প্ৰতি সপ্তাহে'], min: ['মিনিট'], hour: ['ঘণ্টা', 'ঘন্টা'], baad: ['পিছত'],
      mon: ['সোমবাৰ'], tue: ['মঙ্গলবাৰ'], wed: ['বুধবাৰ'], thu: ['বৃহস্পতিবাৰ'], fri: ['শুকুৰবাৰ'], sat: ['শনিবাৰ'], sun: ['দেওবাৰ'],
    },
  },
  { // Gujarati
    words: {
      today: ['આજે', 'આજ'], tomorrow: ['કાલે', 'કાલ'], after2: ['પરમદિવસે', 'પરમ દિવસે'], morning: ['સવારે', 'સવાર'], noon: ['બપોરે', 'બપોર'], evening: ['સાંજે', 'સાંજ'], night: ['રાત્રે', 'રાતે', 'રાત'],
      baje: ['વાગ્યે', 'વાગે'], daily: ['દરરોજ', 'રોજ'], weekly: ['દર અઠવાડિયે', 'દર અઠવાડિયા'], min: ['મિનિટ'], hour: ['કલાક'], baad: ['પછી'],
      mon: ['સોમવાર'], tue: ['મંગળવાર'], wed: ['બુધવાર'], thu: ['ગુરુવાર'], fri: ['શુક્રવાર'], sat: ['શનિવાર'], sun: ['રવિવાર'],
    },
  },
  { // Punjabi
    words: {
      today: ['ਅੱਜ'], tomorrow: ['ਕੱਲ੍ਹ', 'ਕੱਲ'], after2: ['ਪਰਸੋਂ'], morning: ['ਸਵੇਰੇ', 'ਸਵੇਰ'], noon: ['ਦੁਪਹਿਰ'], evening: ['ਸ਼ਾਮ'], night: ['ਰਾਤ'],
      baje: ['ਵਜੇ'], daily: ['ਹਰ ਰੋਜ਼', 'ਹਰ ਦਿਨ', 'ਰੋਜ਼'], weekly: ['ਹਰ ਹਫ਼ਤੇ', 'ਹਰ ਹਫਤੇ'], min: ['ਮਿੰਟ'], hour: ['ਘੰਟੇ', 'ਘੰਟਾ'], baad: ['ਬਾਅਦ'],
      mon: ['ਸੋਮਵਾਰ'], tue: ['ਮੰਗਲਵਾਰ'], wed: ['ਬੁੱਧਵਾਰ'], thu: ['ਵੀਰਵਾਰ'], fri: ['ਸ਼ੁੱਕਰਵਾਰ'], sat: ['ਸ਼ਨੀਵਾਰ'], sun: ['ਐਤਵਾਰ'],
    },
  },
  { // Odia
    words: {
      today: ['ଆଜି'], tomorrow: ['କାଲି'], after2: ['ପରଶ୍ୱ', 'ପରଶୁ'], morning: ['ସକାଳେ', 'ସକାଳ'], noon: ['ଦିପହରେ', 'ଦିପହର'], evening: ['ସନ୍ଧ୍ୟାରେ', 'ସନ୍ଧ୍ୟା'], night: ['ରାତିରେ', 'ରାତି'],
      baje: ['ଟାରେ', 'ବାଜିକି'], daily: ['ପ୍ରତିଦିନ'], weekly: ['ପ୍ରତି ସପ୍ତାହ'], min: ['ମିନିଟ୍', 'ମିନିଟ'], hour: ['ଘଣ୍ଟା'], baad: ['ପରେ'],
      mon: ['ସୋମବାର'], tue: ['ମଙ୍ଗଳବାର'], wed: ['ବୁଧବାର'], thu: ['ଗୁରୁବାର'], fri: ['ଶୁକ୍ରବାର'], sat: ['ଶନିବାର'], sun: ['ରବିବାର'],
    },
  },
  { // Urdu
    rtl: true,
    words: {
      today: ['آج'], tomorrow: ['کل'], after2: ['پرسوں'], morning: ['صبح'], noon: ['دوپہر'], evening: ['شام'], night: ['رات'],
      baje: ['بجے'], daily: ['ہر روز', 'روزانہ', 'روز'], weekly: ['ہر ہفتے', 'ہر ہفتہ'], min: ['منٹ'], hour: ['گھنٹے', 'گھنٹہ', 'گھنٹا'], baad: ['بعد'],
      mon: ['پیر'], tue: ['منگل'], wed: ['بدھ'], thu: ['جمعرات'], fri: ['جمعہ'], sat: ['ہفتہ'], sun: ['اتوار'],
    },
  },
  { // Tamil (endings are glued on, so only the start of a word is checked)
    suffix: true,
    words: {
      today: ['இன்று'], tomorrow: ['நாளை'], after2: ['நாளைமறுநாள்'], morning: ['காலை'], noon: ['மதியம்'], evening: ['மாலை'], night: ['இரவு'],
      baje: ['மணிக்கு'], daily: ['தினமும்', 'ஒவ்வொரு நாளும்'], weekly: ['ஒவ்வொரு வாரமும்'], min: ['நிமிடங்கள்', 'நிமிடம்', 'நிமிடத்தில்'], hour: ['மணி நேரம்', 'மணிநேரம்'], baad: ['பிறகு'],
      mon: ['திங்கள்'], tue: ['செவ்வாய்'], wed: ['புதன்'], thu: ['வியாழன்'], fri: ['வெள்ளி'], sat: ['சனி'], sun: ['ஞாயிறு'],
    },
  },
  { // Telugu
    suffix: true,
    words: {
      today: ['ఈ రోజు', 'ఈరోజు', 'నేడు'], tomorrow: ['రేపు'], after2: ['ఎల్లుండి'], morning: ['ఉదయం'], noon: ['మధ్యాహ్నం'], evening: ['సాయంత్రం'], night: ['రాత్రి'],
      baje: ['గంటలకు', 'గంటకు'], daily: ['ప్రతిరోజూ', 'ప్రతి రోజు', 'రోజూ'], weekly: ['ప్రతి వారం'], min: ['నిమిషాలు', 'నిమిషం', 'నిమిషాల'], hour: ['గంటలు', 'గంట'], baad: ['తర్వాత'],
      mon: ['సోమవారం'], tue: ['మంగళవారం'], wed: ['బుధవారం'], thu: ['గురువారం'], fri: ['శుక్రవారం'], sat: ['శనివారం'], sun: ['ఆదివారం'],
    },
  },
  { // Kannada
    suffix: true,
    words: {
      today: ['ಇಂದು'], tomorrow: ['ನಾಳೆ'], after2: ['ನಾಡಿದ್ದು'], morning: ['ಬೆಳಿಗ್ಗೆ', 'ಬೆಳಗ್ಗೆ'], noon: ['ಮಧ್ಯಾಹ್ನ'], evening: ['ಸಂಜೆ'], night: ['ರಾತ್ರಿ'],
      baje: ['ಗಂಟೆಗೆ'], daily: ['ಪ್ರತಿದಿನ', 'ಪ್ರತಿ ದಿನ'], weekly: ['ಪ್ರತಿ ವಾರ'], min: ['ನಿಮಿಷಗಳ', 'ನಿಮಿಷ'], hour: ['ಗಂಟೆಗಳ', 'ಗಂಟೆ'], baad: ['ನಂತರ'],
      mon: ['ಸೋಮವಾರ'], tue: ['ಮಂಗಳವಾರ'], wed: ['ಬುಧವಾರ'], thu: ['ಗುರುವಾರ'], fri: ['ಶುಕ್ರವಾರ'], sat: ['ಶನಿವಾರ'], sun: ['ಭಾನುವಾರ'],
    },
  },
  { // Malayalam
    suffix: true,
    words: {
      today: ['ഇന്ന്'], tomorrow: ['നാളെ'], after2: ['മറ്റന്നാൾ'], morning: ['രാവിലെ'], noon: ['ഉച്ചയ്ക്ക്', 'ഉച്ചക്ക്'], evening: ['വൈകുന്നേരം'], night: ['രാത്രി'],
      baje: ['മണിക്ക്'], daily: ['എല്ലാ ദിവസവും', 'ദിവസവും'], weekly: ['എല്ലാ ആഴ്ചയും'], min: ['മിനിറ്റ്'], hour: ['മണിക്കൂർ'], baad: ['ശേഷം'],
      mon: ['തിങ്കൾ'], tue: ['ചൊവ്വ'], wed: ['ബുധൻ'], thu: ['വ്യാഴം'], fri: ['വെള്ളി'], sat: ['ശനി'], sun: ['ഞായർ'],
    },
  },
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const L = '(?<![\\p{L}\\p{M}])';
const R = '(?![\\p{L}\\p{M}])';

const RULES = [];
const BAAD = [];
for (const set of SETS) {
  for (const [key, list] of Object.entries(set.words)) {
    if (key === 'baad') { BAAD.push(...list); continue; } // only meaningful straight after "30 min" (handled below)
    for (const native of list) RULES.push({ native, en: GROUPS[key], len: native.length, suffix: !!set.suffix });
  }
}
RULES.sort((a, b) => b.len - a.len); // longest first, so "रात्री" wins over "रात"
const COMPILED = RULES.map((r) => ({ re: new RegExp(`${L}${escape(r.native)}${r.suffix ? '' : R}`, 'gu'), en: ` ${r.en} ` }));

// First digit (zero) of each script, so "६" or "௬" or "۶" becomes 6
const ZEROS = [0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66];
function asciiDigits(text) {
  return text.replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0);
    if (cp >= 48 && cp <= 57) return ch;
    for (const z of ZEROS) if (cp >= z && cp <= z + 9) return String(cp - z);
    return ch;
  });
}

BAAD.sort((a, b) => b.length - a.length);
const AFTER = new RegExp(`(\\b(?:min|hours)\\s+)(?:${BAAD.map(escape).join('|')})(?![\\p{L}\\p{M}])`, 'gu');

const NON_LATIN = /[^\u0000-ɏ -⁯]/u;

/** "कल शाम 6 बजे जिम" -> "tomorrow evening 6 baje जिम". Text with no Indian-script words comes back unchanged. */
export function normalizeLocal(text) {
  let s = String(text ?? '');
  if (!NON_LATIN.test(s)) return s;
  s = asciiDigits(s);
  for (const { re, en } of COMPILED) s = s.replace(re, en);
  s = s.replace(/\s+/g, ' ');
  return s.replace(AFTER, '$1baad').trim();
}
