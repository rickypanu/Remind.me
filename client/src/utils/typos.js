// Layer 1 of quick add: forgive typing mistakes. Runs before the parser and only rewrites the few words the parser
// understands (days, "tomorrow", "evening", "baje", "minutes" ...). Everything else the person typed is left alone.
//
//   "tmrw 6 bje gym"            -> "tomorrow 6 baje gym"
//   "thrusday evning 5 pm"      -> "thursday evening 5 pm"
//   "kal paanch baje padhna"    -> "kal 5 baje padhna"
//   "dedh baje lunch"           -> "1:30 baje lunch"
//   "in five minutes"           -> "in 5 minutes"

// Spellings people really use. Exact match, no guessing involved.
const ALIASES = {
  tmrw: 'tomorrow', tmr: 'tomorrow', tmrrw: 'tomorrow', tmorow: 'tomorrow', tomoro: 'tomorrow', tomorow: 'tomorrow', tommorow: 'tomorrow',
  tommorrow: 'tomorrow', tomorrw: 'tomorrow', '2moro': 'tomorrow', '2morrow': 'tomorrow', '2mrw': 'tomorrow',
  tonite: 'tonight', tnite: 'tonight', '2nite': 'tonight', tonit: 'tonight',
  kl: 'kal', kall: 'kal', aj: 'aaj', aajj: 'aaj', parsso: 'parso', parson: 'parso',
  saam: 'sham', shaam: 'sham', shyam: null, // "Shyam" is a name: never touched
  suba: 'subah', subh: 'subah', savre: 'savere', subeh: 'subah',
  dopeher: 'dopahar', dopehar: 'dopahar', dupahar: 'dopahar', dopher: 'dopahar', dupher: 'dopahar', dophar: 'dopahar',
  raaat: 'raat', raath: 'raat', rat: null,
  bje: 'baje', bajey: 'baje', bajae: 'baje', baajey: 'baje', bajhe: 'baje', baaje: 'baje', bajee: 'baje', bjy: 'baje',
  mins: 'minutes', min: 'minutes', mnts: 'minutes', mnt: 'minutes', minuts: 'minutes', minutess: 'minutes', mints: 'minutes',
  hrs: 'hours', hr: 'hours', hurs: 'hours', hrss: 'hours',
  nxt: 'next', nex: 'next', evry: 'every', evey: 'every', evary: 'every', evrey: 'every', evrry: 'every',
  dailly: 'daily', dayly: 'daily', daly: 'daily', dly: 'daily', wkly: 'weekly', weakly: 'weekly', weekley: 'weekly',
  wknd: 'weekend', wkend: 'weekend', wknds: 'weekends', wkends: 'weekends',
};

// Words the parser needs, for the "one letter off" matching. Real words that sit one letter away from these are
// listed in PROTECT so they are never changed ("dairy", "mourning", "sundae" ...).
const VOCAB = [
  'tomorrow', 'today', 'tonight', 'morning', 'afternoon', 'evening', 'midnight', 'night',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'weekdays', 'weekends', 'weekly', 'daily', 'every', 'minutes', 'minute', 'hours',
  'somvar', 'mangalvar', 'budhvar', 'guruvar', 'shukravar', 'shanivar', 'ravivar',
  'subah', 'savere', 'dopahar', 'shaam', 'raat',
];
const PROTECT = new Set([
  'dairy', 'mourning', 'sundae', 'sundays', 'mondays', 'fridays', 'weakly', 'toady', 'tidy', 'midnights', 'eventing',
  'hourly', 'morons', 'mornings', 'evenings', 'nights', 'tonights', 'minuets', 'minute', 'avery',
]);
const VOCAB_SET = new Set(VOCAB);

/** Edit distance where swapping two neighbouring letters counts as one mistake. */
export function distance(a, b) {
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > 2) return 3;
  const d = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i += 1) d[i][0] = i;
  for (let j = 0; j <= bl; j += 1) d[0][j] = j;
  for (let i = 1; i <= al; i += 1) {
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[al][bl];
}

/** The one vocabulary word this token is a typo of, or null (null as well when two words are equally close). */
export function nearestWord(token) {
  if (token.length < 5 || VOCAB_SET.has(token) || PROTECT.has(token)) return null;
  let best = null;
  let bestDist = 9;
  let tie = false;
  for (const word of VOCAB) {
    if (word[0] !== token[0]) continue; // people rarely get the first letter wrong
    const allowed = word.length >= 8 && token.length >= 6 ? 2 : 1;
    const dist = distance(token, word);
    if (dist > allowed) continue;
    if (dist < bestDist) { best = word; bestDist = dist; tie = false; } else if (dist === bestDist && word !== best) tie = true;
  }
  return tie ? null : best;
}

// ---- spoken numbers: "paanch baje", "in five minutes", "dedh baje", "saade teen baje" ------------
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12,
  pandrah: 15, bees: 20, tees: 30,
};
const NUM = `(${Object.keys(NUMBER_WORDS).join('|')})`;
// A number word only becomes a digit when a time word follows it, so "do homework" or "one more chapter" stay as typed.
const UNIT = '(?=\\s*(?:baje|bje|am\\b|pm\\b|o\'?clock|oclock|min|mins|minutes?|hours?|hrs?|ghante|ghanta|baad|bad)\\b)';

function spokenNumbers(text) {
  let s = text;
  s = s.replace(/\bdedh\s+(?:baje|bje)\b/g, '1:30 baje');
  s = s.replace(/\b(?:dhai|dhaai)\s+(?:baje|bje)\b/g, '2:30 baje');
  s = s.replace(new RegExp(`\\bsaade?\\s+${NUM}\\s+(?:baje|bje)\\b`, 'g'), (_, w) => `${NUMBER_WORDS[w]}:30 baje`);
  s = s.replace(new RegExp(`\\bsawa\\s+${NUM}\\s+(?:baje|bje)\\b`, 'g'), (_, w) => `${NUMBER_WORDS[w]}:15 baje`);
  s = s.replace(new RegExp(`\\bpaune\\s+${NUM}\\s+(?:baje|bje)\\b`, 'g'), (_, w) => `${(NUMBER_WORDS[w] || 1) - 1 || 12}:45 baje`);
  s = s.replace(new RegExp(`\\b${NUM}${UNIT}`, 'g'), (_, w) => String(NUMBER_WORDS[w]));
  s = s.replace(/\b(?:in|after)\s+(?:an?|one)\s+hour\b/g, 'in 1 hours');
  return s;
}

/** The text with typing mistakes in date / time words repaired. Same text back when there is nothing to repair. */
export function fixTypos(text) {
  const input = String(text ?? '');
  const fixed = input.replace(/[A-Za-z0-9']+/g, (word) => {
    const lower = word.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ALIASES, lower)) return ALIASES[lower] === null ? word : ALIASES[lower];
    const near = nearestWord(lower);
    return near || word;
  });
  return spokenNumbers(fixed.replace(/\b(\d+)\s*(?:mins?|mnts?)\b/gi, '$1 minutes'));
}
