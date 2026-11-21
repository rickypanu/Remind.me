// ---------------------------------------------------------------------------
// Instant "quick add" parser. Runs on the phone in a few milliseconds, with no network and no AI quota:
//
//   "gym every monday and thursday 7am"   -> weekly, Mon + Thu, 07:00
//   "kal sham 6 baje maths assignment"    -> once, tomorrow 18:00
//   "call mom in 30 min"                  -> once, now + 30 minutes
//   "submit report"                       -> once, the next clean half-hour slot about 2 hours ahead (never 10:33 pm)
//   "I need to remember to bring my charger for tomorrows exam at 9" -> "Bring charger for exam", tomorrow 09:00
//
// Everything is IST (UTC+05:30), like the rest of the app. The result is a normal `createTask()` payload, so the
// reminder is saved on the device at once and uploaded in the background. `confidence` is "low" when the sentence
// had a lot of words but nothing the parser could pin down; the caller may show a gentle hint.
//
// The reminder has a TITLE ONLY (description is always null): the sentence is cleaned (lead-in words like "I need to"
// and the date / time words are taken out) and kept short, so nothing the person said is lost into a second field.
//
// Pure functions, no imports from the app (easy to test). The app, the website and server/utils/quick_parse.py
// are the same parser: change one, change all three (tests/test_quick_parse.py compares them).
// ---------------------------------------------------------------------------

import { normalizeLocal } from './localWords.js';
import { fixTypos } from './typos.js';
import { pickCategory } from './categoryModel.js';
import { habitClock, habitKey } from './timeHabits.js';

const IST_OFFSET_MS = 330 * 60 * 1000;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const DEFAULT_LEAD_MS = 2 * HOUR;
const SLOT_MS = 30 * MIN; // a default time is always on the hour or half hour
const EARLIEST_DEFAULT_HOUR = 7; // a default reminder never rings before 7 am ...
const LATEST_DEFAULT_HOUR = 22; // ... or from 10 pm on: those wait for 9 am
const DEFAULT_TIME_ON_FUTURE_DAY = [9, 0];

/** The one-tap time words shown under the box when the sentence had no time. `word` is appended to the sentence. */
export const TIME_CHIPS = [
  { word: 'morning', label: 'Morning · 9 AM' },
  { word: 'afternoon', label: 'Afternoon · 2 PM' },
  { word: 'evening', label: 'Evening · 6 PM' },
  { word: 'night', label: 'Night · 9 PM' },
];

// "after lunch", "before bed", "end of day": a phrase for a moment of the day, with the clock time it usually means.
const MOMENTS = {
  'before breakfast': [7, 30],
  'after breakfast': [9, 30],
  'before lunch': [12, 30],
  'after lunch': [13, 30],
  'before dinner': [19, 30],
  'after dinner': [21, 0],
  'before bed': [22, 30],
  'end of day': [17, 0],
};
const MOMENT_RE = /\b(?:(before|after)\s+(breakfast|lunch|dinner|supper|bed(?:\s*time)?|sleeping|sleep)|(bed\s*time)|(end\s+of\s+(?:the\s+)?day|eod))\b/;

// A sentence that names a meal or an outing has a usual time when the day is given but not the hour.
const KEYWORD_CLOCKS = [
  [/\bbreakfast\b/, [8, 30]],
  [/\blunch\b/, [13, 0]],
  [/\b(?:dinner|supper)\b/, [20, 0]],
  [/\b(?:call|phone|ring|movie|party|catch up|hangout)\b/, [18, 0]],
];

// "wake up at 6" is 6 am and "dinner at 8" is 8 pm, even though the person never said am / pm.
const AM_WORDS = /\b(?:wake|wakeup|alarm|jog\w*|yoga|breakfast|meditat\w*|school|namaz|puja)\b/; // not "gym" / "walk": those are as often in the evening
const PM_WORDS = /\b(?:dinner|supper|party|movie|concert|date|drinks|netflix|tv)\b/;

export const QUICK_CATEGORIES = ['Assignment', 'Project', 'Exam / Quiz', 'Placement / Internship', 'Extracurricular', 'Personal', 'Other'];

// ---- IST helpers ---------------------------------------------------------------------------------
/** The wall clock in IST for an instant, as plain numbers. weekday: 0 = Monday ... 6 = Sunday. */
function istParts(ms) {
  const d = new Date(ms + IST_OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth(),
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    weekday: (d.getUTCDay() + 6) % 7,
  };
}
/** IST wall clock -> instant (ms). Day overflow is fine (Date.UTC normalises it). */
const fromIst = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo, d, h, mi) - IST_OFFSET_MS;
const floorMinute = (ms) => Math.floor(ms / MIN) * MIN;
const dayStart = (ms) => {
  const p = istParts(ms);
  return fromIst(p.y, p.mo, p.d);
};

// ---- vocabulary ----------------------------------------------------------------------------------
const WEEKDAY_WORDS = {
  mon: 0, monday: 0, somvar: 0, somwar: 0,
  tue: 1, tues: 1, tuesday: 1, mangalvar: 1, mangalwar: 1,
  wed: 2, weds: 2, wednesday: 2, budhvar: 2, budhwar: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3, guruvar: 3, guruwar: 3, brihaspativar: 3, veervar: 3,
  fri: 4, friday: 4, shukravar: 4, shukrawar: 4,
  sat: 5, saturday: 5, shanivar: 5, shaniwar: 5,
  sun: 6, sunday: 6, ravivar: 6, raviwar: 6, itwar: 6,
};
const DAY_NAME = '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:rs?(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|somvar|somwar|mangalvar|mangalwar|budhvar|budhwar|guruvar|guruwar|brihaspativar|veervar|shukravar|shukrawar|shanivar|shaniwar|ravivar|raviwar|itwar)';

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const MONTH_NAME = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

// Part of day -> [default clock, how an ambiguous "N baje / N o'clock" is read]
const PARTS = {
  morning: { at: [9, 0], word: '(?:morning|subah|subha|savere)' },
  afternoon: { at: [14, 0], word: '(?:afternoon|dopahar|dophar)' },
  evening: { at: [18, 0], word: '(?:evening|sham|shaam)' },
  night: { at: [21, 0], word: '(?:night|raat|tonight)' },
};
const PART_ANY = '(?:morning|subah|subha|savere|afternoon|dopahar|dophar|evening|sham|shaam|night|raat|tonight)';

const CATEGORY_RULES = [
  ['Exam / Quiz', /\b(exam|quiz|test|viva|paper|midterm|mid-sem|endsem|end-sem|revision|revise|syllabus|practical)\b/],
  ['Placement / Internship', /\b(interview|placement|internship|resume|cv|oa|assessment|hackathon|recruiter|offer letter|aptitude|gd)\b/],
  ['Assignment', /\b(assignment|homework|hw|lab file|record|worksheet|submit|submission|report|essay|notes)\b/],
  ['Project', /\b(project|deploy|deployment|commit|prototype|demo|presentation|ppt|code|coding|bug|build)\b/],
  ['Extracurricular', /\b(gym|workout|run|running|yoga|club|practice|rehearsal|match|cricket|football|gaming|guitar|dance|meditat\w*|sports?|walk)\b/],
  ['Personal', /\b(mom|mum|dad|mother|father|bhai|didi|friend|birthday|bday|call|buy|bill|rent|recharge|doctor|medicine|pay|grocer\w*|shopping|laundry|water|sleep|bank|pick up|dinner|lunch|breakfast|train|flight|ticket|trip)\b/],
];

// ---- tiny regex toolkit --------------------------------------------------------------------------
/** Finds `re` in `state.text`, blanks the matched part out, returns the match (or null). */
function take(state, re) {
  const m = re.exec(state.text);
  if (!m) return null;
  state.text = `${state.text.slice(0, m.index)} ${state.text.slice(m.index + m[0].length)}`;
  return m;
}

function pickWeekdays(chunk) {
  const out = new Set();
  for (const m of chunk.matchAll(new RegExp(`\\b${DAY_NAME}\\b`, 'g'))) {
    const n = WEEKDAY_WORDS[m[0]] ?? WEEKDAY_WORDS[m[0].slice(0, 3)]; // "thurday" typo still means Thursday
    if (n !== undefined) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

// ---- 12-hour -> 24-hour --------------------------------------------------------------------------
function to24(hour12, meridiem) {
  const pm = /^p/i.test(meridiem);
  return pm ? (hour12 % 12) + 12 : hour12 % 12;
}

/** "5 baje" / "at 5" with no am/pm: use the word for the part of the day if there is one, else the likeliest reading. */
function guessHour(h, minute, partKey, nowMs, bias = null, futureDay = false) {
  if (h >= 13) return h; // already 24-hour
  if (partKey === 'morning') return h === 12 ? 12 : h;
  if (partKey === 'afternoon') return h === 12 ? 12 : h + 12;
  if (partKey === 'evening') return h === 12 ? 0 : h + 12;
  if (partKey === 'night') return h === 12 ? 0 : h >= 6 ? h + 12 : h; // "raat 2 baje" is 02:00, "raat 9 baje" is 21:00
  if (h === 12) return 12;
  if (bias === 'am') return h; // "wake up at 6", "gym at 7"
  if (bias === 'pm') return h + 12; // "dinner at 8", "movie at 7"
  if (h >= 1 && h <= 6) return h + 12; // nobody sets "3" for 3 in the morning
  if (futureDay) return h; // "tomorrow at 9" is 9 am; the "next time it happens" rule below is only for today
  // 7-11: the next time it happens: this morning if still ahead, else this evening, else tomorrow morning
  const now = istParts(nowMs);
  const nowMin = now.h * 60 + now.mi;
  if (nowMin < h * 60 + minute) return h;
  if (nowMin < (h + 12) * 60 + minute) return h + 12;
  return h;
}

// ---- the parser ----------------------------------------------------------------------------------
/**
 * @param {string} input what the user typed or said
 * @param {number} [nowMs] injectable clock for tests
 * @param {object|null} [habits] the person's usual times (see timeHabits.js); used only when the sentence has no time
 * @returns {{ payload: object, confidence: 'high'|'low', found: string[] } | null} null for empty input
 */
export function parseQuick(input, nowMs = Date.now(), habits = null) {
  const original = fixTypos(normalizeLocal(String(input ?? '').replace(/\s+/g, ' ').trim()));
  if (!original) return null;
  const now = floorMinute(nowMs);
  const nowP = istParts(now);
  const state = { text: ` ${original.toLowerCase().replace(/[“”]/g, '"')} ` };
  const found = [];

  // 1. "in 30 min", "after 2 hours", "30 min baad"
  let relativeMs = null;
  let relativeInDays = false;
  {
    const m =
      take(state, /\b(?:in|after)\s+(\d+(?:\.\d+)?|an?|half an?)\s*(min(?:ute)?s?|hours?|hrs?|h|days?)\b/) ||
      take(state, /\b(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|ghant[ea]|hours?|hrs?)\s*(?:baad|bad|mein|me)\b/);
    if (m) {
      const raw = m[1];
      const n = /^half/.test(raw) ? 0.5 : /^an?$/.test(raw) ? 1 : Number(raw);
      const unit = m[2][0] === 'm' ? MIN : m[2][0] === 'd' ? DAY : HOUR; // m(in), d(ays), h / g(hante)
      if (n > 0 && n <= 1000) {
        relativeMs = now + Math.round(n * unit);
        relativeInDays = unit === DAY;
        found.push('relative');
      }
    }
  }

  // 2. Repeats
  let schedule = 'once';
  let weekdays = [];
  let partFromRepeat = null;
  if (relativeMs === null) {
    let m;
    if ((m = take(state, new RegExp(`\\b(?:every|each|har)\\s+((?:${DAY_NAME}\\b[\\s,&]*(?:and\\b|aur\\b)?[\\s,&]*)+)`)))) {
      schedule = 'weekly';
      weekdays = pickWeekdays(m[1]);
      if (!weekdays.length) weekdays = [nowP.weekday]; // a weekly reminder with no weekday would be refused by the server
    }
    if (schedule === 'once' && take(state, /\b(?:every\s*weekdays?|weekdays|monday to friday|mon-fri)\b/)) {
      schedule = 'weekly';
      weekdays = [0, 1, 2, 3, 4];
    } else if (schedule === 'once' && take(state, /\b(?:every\s*weekends?|weekends)\b/)) {
      schedule = 'weekly';
      weekdays = [5, 6];
    }
    if (schedule === 'once' && (m = take(state, new RegExp(`\\bevery\\s+(${PART_ANY})\\b`)))) {
      schedule = 'daily';
      partFromRepeat = Object.keys(PARTS).find((k) => new RegExp(`^${PARTS[k].word}$`).test(m[1]));
    }
    if (schedule === 'once' && take(state, /\b(?:every\s*day|everyday|daily|each day|roz(?:ana)?|har\s*din|hr\s*din)\b/)) {
      schedule = 'daily';
    }
    if (schedule === 'once' && take(state, /\b(?:every\s*week|weekly|each week|har\s*hafte|har\s*week)\b/)) {
      schedule = 'weekly';
      weekdays = [nowP.weekday];
    }
    if (schedule !== 'once') found.push('repeat');
  }

  // 3. Date (one-time reminders)
  let dayMs = null; // IST midnight of the named day
  let barePast = false;
  if (schedule === 'once' && relativeMs === null) {
    let m;
    // "hackathon 21-22 nov": a deadline is the end of the range, so keep the last day
    state.text = state.text.replace(new RegExp(`\\b\\d{1,2}\\s*[-–]\\s*(\\d{1,2})\\s+(${MONTH_NAME})\\b`), '$1 $2');
    if ((m = take(state, /\b(?:day after tomorrow|parso|parson|overmorrow)\b/))) dayMs = dayStart(now) + 2 * DAY;
    else if ((m = take(state, /\b(?:tomorrow|tmrw|tmr|tomorow|tommorow)(?:'?s)?\b|\bkal\b/))) dayMs = dayStart(now) + DAY;
    else if ((m = take(state, /\b(?:today(?:'?s)?|aaj|tonight(?:'?s)?)\b/))) dayMs = dayStart(now);
    else if ((m = take(state, /\bnext week\b/))) dayMs = dayStart(now) + 7 * DAY;
    else if ((m = take(state, new RegExp(`\\b(?:(next|this|coming|agle)\\s+)?(?:on\\s+)?(${DAY_NAME})\\b`)))) {
      const target = WEEKDAY_WORDS[m[2]];
      let ahead = (target - nowP.weekday + 7) % 7;
      if (m[1] === 'next' || m[1] === 'agle') ahead = ahead === 0 ? 7 : ahead;
      dayMs = dayStart(now) + ahead * DAY;
      barePast = ahead === 0; // today: only valid if the time is still ahead (checked below)
    } else if ((m = take(state, new RegExp(`\\b(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${MONTH_NAME})\\b(?:\\s*,?\\s*(\\d{4}))?`)))) {
      dayMs = namedDate(nowP, Number(m[1]), MONTHS[m[2]], m[3]);
    } else if ((m = take(state, new RegExp(`\\b(${MONTH_NAME})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{4}))?`)))) {
      dayMs = namedDate(nowP, Number(m[2]), MONTHS[m[1]], m[3]);
    } else if ((m = take(state, /\b(?:by|on|before|till|until)?\s*(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?!\s*(?:of\s+)?(?:every|each))/))) {
      // "pay fees by 15th": the next 15th (this month if it is still ahead, otherwise next month)
      dayMs = nextDayOfMonth(nowP, Number(m[1]));
    } else if ((m = take(state, /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) {
      // 2026-11-05 (year first). Without this the day-first rule below would read "11-05" as 11 May.
      const month = Number(m[2]) - 1;
      if (month >= 0 && month <= 11) dayMs = namedDate(nowP, Number(m[3]), month, m[1]);
    } else if ((m = take(state, /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) {
      // India writes day first: 5/11 is 5 November
      const day = Number(m[1]);
      const month = Number(m[2]) - 1;
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11) dayMs = namedDate(nowP, day, month, m[3] && (m[3].length === 2 ? `20${m[3]}` : m[3]));
    }
    if (dayMs !== null) found.push('date');
  }

  // 4. Time of day
  let clock = null; // [h, m]
  let partKey = partFromRepeat;
  let clockFromPart = false;
  const lowerOriginal = original.toLowerCase();
  const bias = AM_WORDS.test(lowerOriginal) !== PM_WORDS.test(lowerOriginal) ? (AM_WORDS.test(lowerOriginal) ? 'am' : 'pm') : null;
  // "tomorrow at 9" and "every day at 10" are mornings; the "next time it happens" reading is only for a one-time reminder today
  const futureDay = schedule !== 'once' || (dayMs !== null && dayMs > dayStart(now));
  const guess = (h, minute) => guessHour(h === 24 ? 0 : h, minute, partKey, now, bias, futureDay);
  {
    let m;
    // "tonight" already consumed above as a date word; remember it as a part of the day
    if (/\btonight\b/i.test(original)) partKey = 'night';
    const partMatch = new RegExp(`\\b(${PART_ANY})\\b`).exec(state.text);
    if (partMatch && !partKey) partKey = Object.keys(PARTS).find((k) => new RegExp(`^${PARTS[k].word}$`).test(partMatch[1])) || null;

    // "after lunch", "before bed", "end of day": taken out of the sentence always, used only when no clock time was said
    const moment = take(state, MOMENT_RE);

    if ((m = take(state, /\b(half\s+past|quarter\s+past|quarter\s+to)\s+(\d{1,2})(?:\s*(a\.?m\.?|p\.?m\.?))?(?=\W|$)/))) {
      const h = Number(m[2]);
      if (h >= 1 && h <= 12) {
        const to = m[1].endsWith('to');
        const hh = to ? (h === 1 ? 12 : h - 1) : h;
        const minute = m[1].startsWith('half') ? 30 : to ? 45 : 15;
        clock = [m[3] ? to24(hh, m[3]) : guess(hh, minute), minute];
      }
    }
    // "5pm", "5:30 pm" and the spoken "9 15 am"
    if (!clock && (m = take(state, /\b(?:at\s+|@\s*)?(\d{1,2})(?:[:.\s](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?=\W|$)/))) {
      const h = Number(m[1]);
      if (h >= 1 && h <= 12 && Number(m[2] || 0) <= 59) clock = [to24(h, m[3]), Number(m[2] || 0)];
    }
    if (!clock && (m = take(state, /\b(?:at\s+|@\s*)?([01]?\d|2[0-3]):([0-5]\d)\b/))) {
      const h = Number(m[1]);
      const minute = Number(m[2]);
      // "17:30" and "09:00" are 24-hour; "7:30" or "5:15" with no am/pm is read the way people mean it
      clock = h >= 13 || m[1].length === 2 || h === 0 ? [h, minute] : [guess(h, minute), minute];
    }
    if (!clock && (m = take(state, /\b(?:at\s+|@\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:baje|bje|o'?clock|oclock|am|pm)\b/))) {
      const h = Number(m[1]);
      if (h >= 0 && h <= 24 && Number(m[2] || 0) <= 59) clock = [guess(h, Number(m[2] || 0)), Number(m[2] || 0)];
    }
    if (!clock && (m = take(state, /\bat\s+(\d{1,2})(?:[:.](\d{2}))?(?!\d)(?!\s*(?:min|hour|hr|day|week|%))/))) {
      const h = Number(m[1]);
      if (h >= 0 && h <= 24 && Number(m[2] || 0) <= 59) clock = [guess(h, Number(m[2] || 0)), Number(m[2] || 0)];
    }
    if (!clock && take(state, /\b(?:noon|midday|dopahar ko)\b/)) clock = [12, 0];
    if (!clock && take(state, /\b(?:midnight|aadhi raat)\b/)) clock = [0, 0];
    if (!clock && moment) clock = MOMENTS[momentKey(moment)] || null;
    if (clock) found.push('time');
    if (partMatch) state.text = state.text.replace(new RegExp(`\\b${PART_ANY}\\b`), ' ');
    if (!clock && partKey) {
      clock = PARTS[partKey].at;
      clockFromPart = true;
      found.push('part');
    }
  }

  // 5. Title (the title is all there is: no description) and category
  const title = buildTitle(state.text, original);
  const category = pickCategory(title, '', guessCategory(lowerOriginal));

  // 6. A time the person did not say: first a habit of theirs ("gym" is always 6 am), then the usual time for the sentence
  if (!clock && habits) {
    const usual = habitClock(habits, habitKey(title));
    if (usual) {
      clock = usual;
      found.push('habit');
    }
  }
  const usualClock = () => {
    for (const [re, at] of KEYWORD_CLOCKS) if (re.test(lowerOriginal)) return at;
    return null;
  };

  // 7. Resolve the due date / time_of_day
  const payload = { schedule_type: schedule, description: null };
  if (schedule === 'once') {
    let due;
    if (relativeMs !== null) {
      // "in 2 days at 5pm": the day comes from the duration, the clock time from the sentence
      due = relativeInDays && clock ? dayStart(relativeMs) + (clock[0] * 60 + clock[1]) * MIN : relativeMs;
    } else if (dayMs === null && !clock) {
      due = defaultFromNow(now);
    } else if (dayMs === null) {
      due = fromIst(nowP.y, nowP.mo, nowP.d, clock[0], clock[1]);
      if (due <= now) due += DAY; // that time has passed today: tomorrow
    } else if (!clock) {
      const at = usualClock() || DEFAULT_TIME_ON_FUTURE_DAY;
      due = dayMs === dayStart(now) ? defaultFromNow(now, true) : dayMs + (at[0] * 60 + at[1]) * MIN;
    } else {
      due = dayMs + (clock[0] * 60 + clock[1]) * MIN;
      if (clockFromPart && due <= now && dayMs === dayStart(now)) due = defaultFromNow(now, true); // "tonight" said at 23:00
      // "aaj raat 12 baje" / "tonight at 1": the small hours of tonight are after midnight, i.e. the next calendar day
      if (partKey === 'night' && !clockFromPart && clock[0] < 6 && due <= now && dayMs === dayStart(now)) due += DAY;
      if (barePast && due <= now) due += 7 * DAY; // "monday 9am" said on Monday evening means next Monday
    }
    payload.due_date = new Date(due).toISOString();
  } else {
    const [h, m] = clock || usualClock() || [9, 0];
    payload.time_of_day = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (schedule === 'weekly') payload.weekdays = weekdays;
  }

  payload.title = title;
  payload.category = category;

  const wordCount = original.split(' ').length;
  const confidence = found.length > 0 || wordCount <= 3 ? 'high' : 'low';
  // No clock time in a one-time sentence: the time above is a default the person did not choose.
  const assumedTime = schedule === 'once' && !found.includes('relative') && !clock;
  return { payload, confidence, found, assumedTime };
}

function namedDate(nowP, day, month, yearText) {
  if (month === undefined || day < 1 || day > 31) return null;
  // A date that does not exist in that year (31 Feb, 29 Feb in a common year) is not valid: Date.UTC would roll it over.
  const make = (year) => {
    const ms = fromIst(year, month, day);
    return istParts(ms).d === day ? ms : null;
  };
  if (yearText) return make(Number(yearText));
  const today = fromIst(nowP.y, nowP.mo, nowP.d);
  // "5 jan" said in November means next January; "29 feb" waits for the next leap year
  for (let year = nowP.y; year <= nowP.y + 8; year++) {
    const ms = make(year);
    if (ms !== null && ms >= today) return ms;
  }
  return null;
}

/** The next calendar day with this day-of-month (today counts); skips months that do not have it (31st). */
function nextDayOfMonth(nowP, day) {
  if (day < 1 || day > 31) return null;
  const today = fromIst(nowP.y, nowP.mo, nowP.d);
  for (let i = 0; i < 14; i++) {
    const year = nowP.y + Math.floor((nowP.mo + i) / 12);
    const month = (nowP.mo + i) % 12;
    const ms = fromIst(year, month, day);
    if (istParts(ms).d === day && ms >= today) return ms;
  }
  return null;
}

/**
 * The time for a reminder that has none: about 2 hours ahead, on the next hour or half hour (never 10:33 pm).
 * Before 7 am it waits for 9 am; from 10 pm on it waits for 9 am tomorrow (or, when the person said "today", rings
 * in about 10 minutes, on a 5-minute mark).
 */
function defaultFromNow(now, saidToday = false) {
  const slot = Math.ceil((now + DEFAULT_LEAD_MS) / SLOT_MS) * SLOT_MS;
  const sameDay = dayStart(slot) === dayStart(now);
  const hour = istParts(slot).h;
  if (sameDay && hour >= EARLIEST_DEFAULT_HOUR && hour < LATEST_DEFAULT_HOUR) return slot;
  if (sameDay && hour < EARLIEST_DEFAULT_HOUR) return dayStart(now) + 9 * HOUR;
  if (saidToday) {
    const soon = Math.ceil((now + 10 * MIN) / (5 * MIN)) * 5 * MIN;
    return dayStart(soon) === dayStart(now) ? soon : now + 10 * MIN;
  }
  return dayStart(now) + DAY + 9 * HOUR;
}

/** Which MOMENTS entry a MOMENT_RE match means. */
function momentKey(m) {
  if (m[4]) return 'end of day';
  if (m[3]) return 'before bed';
  const what = /^(?:bed|sleep)/.test(m[2]) ? 'bed' : m[2] === 'supper' ? 'dinner' : m[2];
  return `${m[1]} ${what}`;
}

const TITLE_MAX_WORDS = 9;
const TITLE_MAX_CHARS = 60;

// Lead-in words that say "remember this" but are not the thing to remember. Tried over and over, so
// "remind me that I need to remember to bring ..." loses all three.
const LEAD_PATTERNS = [
  /^(?:please|plz|pls|kindly|hey|hi|ok|okay|so|also|then|really|just|actually)\s+/,
  /^(?:can|could|would|will)\s+you\s+(?:please\s+)?/,
  /^(?:remind\s+me|reminder|set\s+(?:a\s+)?reminder|add\s+(?:a\s+)?reminder|mujhe\s+yaad\s+dilao|yaad\s+dilana|add)\s*(?:to|about|for|that|ki|ko|:)?\s*/,
  /^(?:i|we)(?:'ll|\s+will)\s+/,
  /^(?:let\s+me|lemme)\s+/,
  /^(?:i|we|mujhe|mereko|hume|humein)\s+(?:(?:really|just|also)\s+)?(?:need|must|should|gotta|wanna)(?:\s+(?:really|just|actually|also))?(?:\s+to)?\s+/,
  /^(?:i|we)\s+(?:have|got|has)\s+(?:an?|the)\s+/,
  /^(?:i|we|mujhe|mereko|hume|humein)\s+(?:(?:really|just|also)\s+)?(?:have|has|got|want|ought)\s+to\s+/,
  /^(?:mujhe|mereko|hume|humein)\s+/,
  /^(?:need|have|has|got|want)\s+to\s+/,
  /^(?:gotta|must|should|wanna|supposed\s+to)\s+/,
  /^(?:(?:please\s+)?(?:don'?t|do\s+not|never)\s+forget|remember|yaad\s+se|yaad\s+rakhna|yaad\s+rakho|bhoolna\s+mat|make\s+sure)(?:\s+(?:to|that|ki|i|you))?\s+/,
];
const TRAIL_PATTERNS = [/\s+(?:(?:please|plz|pls)\s+)?(?:remind\s+me|reminder)$/, /\s+(?:please|plz|pls|thanks|thank\s+you|ok|okay)$/, /\s+(?:hai|hain|hoga|hogi|tha|thi)$/, /\s+(?:yaad\s+se|yaad\s+rakhna|bhoolna\s+mat)$/];
// A word like "on" / "by" / "before" left standing right before the place where a date or time was taken out
const DANGLING = /\b(?:on|at|by|before|till|until|due|from|around)\s{2,}/g;
const FILLER_EDGES = /^(?:to|about|for|that|ki|ko|ke liye|at|on|by|in|the|a|and|aur|se|tak|par|pe|per|me|mein)\s+|\s+(?:to|about|for|that|ki|ko|ke liye|at|on|by|in|and|aur|se|tak|par|pe|per|me|mein|from|due|before|till|until|deadline)$/;
const TRAILING_STOPWORDS = /\s+(?:to|the|a|an|of|for|and|with|in|on|at|by|from|my|your|our|that|this|every|each|all|any|some|aur|ko|ki|ka|ke|se|me|mein)$/;
const CLAUSE_BREAK = /,|\s(?:because|so that|since|as|but|which|while|kyunki|kyuki|taaki|jab|aur|and)\s/g;

const wordsIn = (t) => t.split(/\s+/).filter(Boolean).length;

/** Spaces, stray commas and dashes at the ends tidied up. */
function tidy(t) {
  return t
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/(?:,\s*){2,}/g, ', ')
    .replace(/^[\s.,:;\-–—]+|[\s.,:;\-–—]+$/g, '')
    .trim();
}

/**
 * The reminder's title from the sentence with its date, time and repeat words already taken out (`text`, lower case).
 * "bring my laptop charger and id card for exam" / "pay rent on 1st of every month" / "call the plumber".
 * Nothing is moved to a description: what the person said stays in the title, only the lead-in and the clock words go.
 */
function buildTitle(text, original) {
  let t = text.replace(DANGLING, ' ');
  t = tidy(t.replace(/\s*[:;|]\s*/g, ', ').replace(/\s[-–—]\s/g, ', ').replace(/\s*[()]\s*/g, ', '));
  for (let pass = 0; pass < 6; pass++) {
    const before = t;
    for (const re of LEAD_PATTERNS) t = t.replace(re, '').trim();
    for (const re of TRAIL_PATTERNS) t = t.replace(re, '').trim();
    t = tidy(t.replace(FILLER_EDGES, ''));
    if (t === before) break;
  }
  if (!t) return 'Reminder';
  if (wordsIn(t) > 6) t = t.replace(/\b(?:my|our)\s+/g, ''); // "submit my assignment to my professor" -> shorter
  t = capTitle(t);
  t = restoreCase(t, original);
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 200);
}

/** A long sentence is cut where one thought ends ("... and", ", because"); with no such place, at the last whole word that fits. */
function capTitle(t) {
  if (wordsIn(t) <= TITLE_MAX_WORDS && t.length <= TITLE_MAX_CHARS) return t;
  CLAUSE_BREAK.lastIndex = 0;
  let m;
  while ((m = CLAUSE_BREAK.exec(t))) {
    const left = tidy(t.slice(0, m.index));
    if (wordsIn(left) >= 3 && wordsIn(left) <= TITLE_MAX_WORDS && left.length <= TITLE_MAX_CHARS) return left;
  }
  const out = [];
  for (const w of t.split(' ')) {
    if (out.length >= TITLE_MAX_WORDS || [...out, w].join(' ').length > TITLE_MAX_CHARS) break;
    out.push(w);
  }
  let cut = tidy(out.join(' '));
  for (let i = 0; i < 3; i++) cut = tidy(cut.replace(TRAILING_STOPWORDS, ''));
  return cut;
}

/** The sentence was lower-cased to match words; give names and abbreviations back their capitals ("DSA", "Rahul"). */
function restoreCase(text, original) {
  const map = new Map();
  for (const w of original.split(' ')) {
    const core = w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (core && core !== core.toLowerCase() && !map.has(core.toLowerCase())) map.set(core.toLowerCase(), core);
  }
  if (!map.size) return text;
  return text.replace(/[\p{L}\p{N}]+/gu, (w) => map.get(w.toLowerCase()) || w);
}

function guessCategory(lower) {
  for (const [category, re] of CATEGORY_RULES) if (re.test(lower)) return category;
  return 'Other';
}
