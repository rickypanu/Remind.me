// Layer 2 of quick add: pick the category of a reminder. No server, no AI quota.
//
// 1. Personal memory first: a title the person already filed ("DSA lab file" -> Assignment), or words they filed the
//    same way at least twice, decide the category. This is learned from the person's own choices (the form, or fixing
//    a category after quick add), stored on this device only.
// 2. The existing keyword rules (precise, so they stay first for everything else).
// 3. A small Naive Bayes model, built in from a word list per category (English, Hinglish, Hindi), for what the
//    keyword rules did not recognise. It also looks at the first 4 letters of long words, so "assigment" still counts.
//
// Pure functions. The storage of the personal part is in a separate small file per platform.

export const CATEGORIES = ['Assignment', 'Project', 'Exam / Quiz', 'Placement / Internship', 'Extracurricular', 'Personal'];

const SEED = {
  Assignment: 'assignment assignments homework hw worksheet submit submission report essay notes record journal tutorial copy register printout print handwritten write writing answer sheet chapter reading read likhna jama kaam lab file observation manual',
  Project: 'project projects deploy deployment commit prototype demo presentation ppt code coding bug build github repo feature website design model dataset train merge review sprint standup client api backend frontend app release module paper-work',
  'Exam / Quiz': 'exam exams quiz test viva paper midterm endsem revision revise syllabus practical study prepare preparation semester sem formula formulas pyq unit cat mst padhna padhai tayari exam-hall admit',
  'Placement / Internship': 'interview placement internship resume cv oa assessment hackathon recruiter offer aptitude gd company referral linkedin apply application job dsa leetcode codeforces mock hr round naukri campus drive',
  Extracurricular: 'gym workout run running yoga club practice rehearsal match cricket football gaming guitar dance meditate meditation sports sport walk badminton swim swimming cycling music singing drawing painting event fest society nss ncc volunteer chess basketball volleyball trek jog',
  Personal: 'mom mum dad mother father bhai didi friend birthday bday call buy bill rent recharge doctor medicine pay grocery groceries shopping laundry water sleep bank pickup dinner lunch breakfast train flight ticket trip haircut salon charge wifi electricity gas vegetables sabzi dawai ghar wedding shaadi party gift movie date dentist',
};

const ALPHA = 0.05; // small, so a single word that only one category knows is already convincing
const PREFIX_WEIGHT = 0.5;
const CONFIDENT = 0.6; // share of the probability the best category needs before it is trusted
const PERSONAL_WEIGHT = 3; // one example the person filed counts as much as three seed words

/** Lower-case words of a text (any script). */
export function words(text) {
  return String(text || '').toLowerCase().match(/[\p{L}\p{M}]{2,}/gu) || [];
}

/** Features of a text: each word, plus ~xxxx (its first four letters) for long words, so small typos still match. */
export function features(text) {
  const out = new Map();
  for (const w of new Set(words(text))) {
    out.set(w, 1);
    if (w.length >= 5 && /^[a-z]+$/.test(w)) out.set(`~${w.slice(0, 4)}`, PREFIX_WEIGHT);
  }
  return out;
}

// ---- built-in model ------------------------------------------------------------------------------
const seedCounts = {};
const vocab = new Set();
for (const [category, list] of Object.entries(SEED)) {
  seedCounts[category] = new Map();
  for (const [f, wgt] of features(list)) {
    seedCounts[category].set(f, (seedCounts[category].get(f) || 0) + wgt);
    vocab.add(f);
  }
}
const seedTotals = Object.fromEntries(Object.entries(seedCounts).map(([c, m]) => [c, [...m.values()].reduce((a, b) => a + b, 0)]));

/**
 * { category, share, matched } for a text, using the built-in model plus the personal counts.
 * `matched` is how many of its features the model knows at all (0 means "no idea").
 */
export function scoreText(text, personal) {
  const feats = features(text);
  const cats = Object.keys(seedCounts);
  const pCounts = personal?.counts || {};
  const pTotals = personal?.totals || {};
  const vocabSize = vocab.size + 1;
  let matched = 0;
  const logp = {};
  for (const c of cats) logp[c] = 0;
  for (const [f, wgt] of feats) {
    const known = vocab.has(f) || cats.some((c) => pCounts[c]?.[f]);
    if (!known) continue;
    matched += 1;
    for (const c of cats) {
      const n = (seedCounts[c].get(f) || 0) + (pCounts[c]?.[f] || 0);
      const total = seedTotals[c] + (pTotals[c] || 0);
      logp[c] += wgt * Math.log((n + ALPHA) / (total + ALPHA * vocabSize));
    }
  }
  if (!matched) return { category: 'Other', share: 0, matched: 0 };
  const top = Math.max(...cats.map((c) => logp[c]));
  const sum = cats.reduce((s, c) => s + Math.exp(logp[c] - top), 0);
  let best = cats[0];
  for (const c of cats) if (logp[c] > logp[best]) best = c;
  return { category: best, share: 1 / sum, matched };
}

// ---- personal memory -----------------------------------------------------------------------------
export const emptyPersonal = () => ({ v: 1, titles: {}, counts: {}, totals: {} });
const titleKey = (title) => words(title).join(' ');

/** A new personal memory with this example added: the title was filed under `category`. */
export function learnCategory(personal, title, category) {
  const key = titleKey(title);
  if (!key || ![...CATEGORIES, 'Other'].includes(category)) return personal || emptyPersonal();
  const next = { v: 1, titles: { ...(personal?.titles || {}) }, counts: { ...(personal?.counts || {}) }, totals: { ...(personal?.totals || {}) } };
  delete next.titles[key]; // re-insert so the newest are kept when the list is trimmed
  next.titles[key] = category;
  const keys = Object.keys(next.titles);
  if (keys.length > 300) for (const old of keys.slice(0, keys.length - 300)) delete next.titles[old];
  if (category !== 'Other') {
    const counts = { ...(next.counts[category] || {}) };
    for (const [f, wgt] of features(title)) {
      counts[f] = (counts[f] || 0) + PERSONAL_WEIGHT * wgt;
      next.totals[category] = (next.totals[category] || 0) + PERSONAL_WEIGHT * wgt;
    }
    next.counts[category] = counts;
  }
  return next;
}

let current = emptyPersonal();
export const getPersonal = () => current;
export const setPersonal = (personal) => { current = personal && personal.v === 1 ? personal : emptyPersonal(); };

/**
 * The category for a reminder.
 * @param {string} title the cleaned title
 * @param {string} detail description / the rest of the sentence ('' if none)
 * @param {string} ruleGuess what the keyword rules said ('Other' when they found nothing)
 */
export function pickCategory(title, detail, ruleGuess, personal = current) {
  const remembered = personal?.titles?.[titleKey(title)];
  if (remembered) return remembered;
  const text = `${title} ${detail || ''}`;
  if (personal && Object.keys(personal.counts || {}).length) {
    const mine = scoreText(text, { counts: personal.counts, totals: personal.totals });
    const fromPersonal = Object.keys(personal.counts).some((c) => Object.keys(personal.counts[c]).some((f) => features(text).has(f)));
    if (fromPersonal && mine.matched && mine.share >= 0.8 && mine.category !== 'Other') return mine.category;
  }
  if (ruleGuess && ruleGuess !== 'Other') return ruleGuess;
  const model = scoreText(text, personal);
  return model.matched && model.share >= CONFIDENT ? model.category : 'Other';
}
