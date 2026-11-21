import { describe, expect, it } from 'vitest';
import { parseQuick, TIME_CHIPS } from './quickParse';
import { habitKey, learnHabit } from './timeHabits';

// Fri 30 Oct 2026, 21:58 IST
const NOW = Date.parse('2026-10-30T21:58:00+05:30');
const ist = (iso) => new Date(Date.parse(iso) + 330 * 60000).toISOString().replace('T', ' ').slice(0, 16);
const run = (text) => parseQuick(text, NOW).payload;

describe('parseQuick', () => {
  it('returns null for empty input', () => {
    expect(parseQuick('   ', NOW)).toBeNull();
  });

  it('reads a weekly repeat with two weekdays', () => {
    const p = run('Gym every monday and thursday 7am');
    expect(p).toMatchObject({ title: 'Gym', schedule_type: 'weekly', time_of_day: '07:00', weekdays: [0, 3] });
  });

  it('reads daily repeats', () => {
    expect(run('drink water every day at 8pm')).toMatchObject({ schedule_type: 'daily', time_of_day: '20:00', title: 'Drink water' });
    expect(run('every morning meditation')).toMatchObject({ schedule_type: 'daily', time_of_day: '09:00' });
  });

  it('understands Hinglish', () => {
    expect(ist(run('kal sham 6 baje maths assignment').due_date)).toBe('2026-10-31 18:00');
    expect(ist(run('parso subah 7 baje train').due_date)).toBe('2026-11-01 07:00');
    expect(ist(run('30 min baad break').due_date)).toBe('2026-10-30 22:28');
  });

  it('reads relative durations', () => {
    expect(ist(run('call mom in 30 min').due_date)).toBe('2026-10-30 22:28');
    expect(ist(run('stretch in 2 hours').due_date)).toBe('2026-10-30 23:58');
  });

  it('reads dates and clock times', () => {
    expect(ist(run('tomorrow 5pm physics exam').due_date)).toBe('2026-10-31 17:00');
    expect(ist(run('Interview on 5 nov at 10:30').due_date)).toBe('2026-11-05 10:30');
    expect(ist(run('dec 25 birthday party 6pm').due_date)).toBe('2026-12-25 18:00');
    expect(ist(run('5/11 submit lab file').due_date)).toBe('2026-11-05 09:00');
    expect(ist(run('next friday 3pm project demo').due_date)).toBe('2026-11-06 15:00');
  });

  it('uses the same defaults as the server', () => {
    // no date, no time: about 2 hours ahead on a clean half hour; late at night (21:58 + 2h is past 10 pm) it waits for 9 am
    expect(ist(run('submit report').due_date)).toBe('2026-10-31 09:00');
    const early = parseQuick('submit report', Date.parse('2026-10-30T10:13:00+05:30')).payload;
    expect(ist(early.due_date)).toBe('2026-10-30 12:30');
    const small = parseQuick('submit report', Date.parse('2026-10-30T02:10:00+05:30')).payload;
    expect(ist(small.due_date)).toBe('2026-10-30 09:00'); // never rings in the small hours
    const today = parseQuick('submit report today', Date.parse('2026-10-30T22:41:00+05:30')).payload;
    expect(ist(today.due_date)).toBe('2026-10-30 22:55'); // "today" said late: soon, on a 5-minute mark
    // a time that has passed today means tomorrow
    expect(ist(run('raat 9 baje dawai').due_date)).toBe('2026-10-31 21:00');
  });

  it('picks a category and cleans the title', () => {
    expect(run('remind me to submit the assignment tomorrow').category).toBe('Assignment');
    expect(run('physics exam tomorrow 9am').category).toBe('Exam / Quiz');
    expect(run('remind me to call mom').title).toBe('Call mom');
  });

  it('flags long sentences with nothing it can place as low confidence', () => {
    expect(parseQuick('finish reading the long paper about graphs', NOW).confidence).toBe('low');
    expect(parseQuick('gym tomorrow 7am', NOW).confidence).toBe('high');
  });

  it('keeps the clock time when the duration is in days', () => {
    expect(ist(run('submit form in 2 days at 5pm').due_date)).toBe('2026-11-01 17:00');
    expect(ist(run('in 2 days').due_date)).toBe('2026-11-01 21:58');
  });

  it('treats small night hours as after midnight, not as a time in the past', () => {
    expect(ist(run('aaj raat 12 baje dawai').due_date)).toBe('2026-10-31 00:00');
    expect(ist(run('tonight at 1 call').due_date)).toBe('2026-10-31 01:00');
  });

  it('reads ISO dates year first and rejects impossible minutes', () => {
    expect(ist(run('2026-11-05 submit lab file').due_date)).toBe('2026-11-05 09:00');
    expect(run('5.75pm call').due_date).toBeDefined();
    expect(ist(run('5.75pm call').due_date)).toBe('2026-10-31 09:00'); // not a time: falls back to the default
  });

  it('never returns a weekly repeat without a weekday', () => {
    expect(run('gym every thurday 7am').weekdays).toEqual([3]);
  });

  it('waits for the next leap year for 29 Feb', () => {
    expect(ist(parseQuick('29 feb exam', Date.parse('2028-03-10T10:00:00+05:30')).payload.due_date)).toBe('2032-02-29 09:00');
  });

  it('reads a bare day of the month ("by 15th")', () => {
    const r = run('pay fees by 15th');
    expect(ist(r.due_date)).toBe('2026-11-15 09:00');
    expect(r.title).toBe('Pay fees');
    expect(ist(run('rent on 1st').due_date)).toBe('2026-11-01 09:00');
  });

  it('keeps the end of a date range and drops "due" from the title', () => {
    expect(ist(run('hackathon 21-22 nov').due_date)).toBe('2026-11-22 09:00');
    expect(run('assignment due sunday').title).toBe('Assignment');
  });
});

describe('title only', () => {
  const at = (s) => parseQuick(s, NOW);
  const title = (s) => at(s).payload.title;
  it('never fills the description: the sentence is cleaned and kept as the title', () => {
    for (const s of ['Submit DSA assignment tomorrow 6pm - include the report and code', 'Buy groceries: milk, eggs, bread tomorrow morning', 'Pay fees by 20th (use the college portal)']) {
      expect(at(s).payload.description).toBe(null);
    }
    expect(title('Submit DSA assignment tomorrow 6pm - include the report and code')).toBe('Submit DSA assignment, include the report and code');
    expect(title('Buy groceries: milk, eggs, bread tomorrow morning')).toBe('Buy groceries, milk, eggs, bread');
    expect(title('Call dad tomorrow 8pm, ask about fees')).toBe('Call dad, ask about fees');
    expect(title('Meeting with Rahul at 5pm about project demo')).toBe('Meeting with Rahul about project demo');
  });
  it('drops lead-in words, however many', () => {
    expect(title('I need to remember to bring my laptop charger and id card for tomorrows exam at 9')).toBe('Bring laptop charger and id card for exam');
    expect(title("don't forget to pay rent")).toBe('Pay rent');
    expect(title('remind me that i have to call the plumber')).toBe('Call the plumber');
    expect(title('please remind me to drink water')).toBe('Drink water');
    expect(title('kal subah 7 baje gym jana hai')).toBe('Gym jana');
  });
  it('takes out the word left standing before a removed date', () => {
    expect(title('submit the DBMS lab file to Prof Sharma before 5:45pm on 25th')).toBe('Submit the DBMS lab file to Prof Sharma');
    expect(title('submit by friday the lab record')).toBe('Submit the lab record');
    expect(title('assignment due sunday')).toBe('Assignment');
  });
  it('cuts a very long sentence where one thought ends', () => {
    const t = title('finish the chemistry practical file and submit it to the lab assistant before the deadline tomorrow');
    expect(t).toBe('Finish the chemistry practical file');
    const long = title('prepare slides for the quarterly review meeting with every department head about hiring plans');
    expect(long.split(' ').length <= 9).toBe(true);
    expect(long).toBe('Prepare slides for the quarterly review meeting');
  });
  it('falls back to "Reminder" when only a date or time was said', () => {
    expect(title('tomorrow')).toBe('Reminder');
    expect(title('7pm')).toBe('Reminder');
    expect(title('remind me tomorrow 5pm')).toBe('Reminder');
  });
  it('keeps capitals the person typed', () => {
    expect(title('submit DSA lab file friday')).toBe('Submit DSA lab file');
  });
  it('says when the time was not given', () => {
    expect(at('buy milk').assumedTime).toBe(true);
    expect(at('buy milk tomorrow 6pm').assumedTime).toBe(false);
    expect(at('call mom in 30 min').assumedTime).toBe(false);
  });
});

describe('times people do not spell out', () => {
  const when = (s, now = NOW) => ist(parseQuick(s, now).payload.due_date);
  // Sat 21 Nov 2026, 20:33 IST
  const SAT = Date.parse('2026-11-21T20:33:00+05:30');
  it('uses clean times, never 10:33 pm', () => {
    expect(when('pay electricity bill', SAT)).toBe('2026-11-22 09:00');
    expect(when('pay electricity bill', Date.parse('2026-11-21T14:41:00+05:30'))).toBe('2026-11-21 17:00');
    expect(when('pay electricity bill', Date.parse('2026-11-21T14:11:00+05:30'))).toBe('2026-11-21 16:30');
  });
  it('reads after lunch, after dinner, before bed, end of day', () => {
    expect(when('remind me after lunch to call the plumber', Date.parse('2026-11-21T10:00:00+05:30'))).toBe('2026-11-21 13:30');
    expect(when('take medicine after dinner', Date.parse('2026-11-21T10:00:00+05:30'))).toBe('2026-11-21 21:00');
    expect(when('take medicine before bed', SAT)).toBe('2026-11-21 22:30');
    expect(when('send the report by end of day', Date.parse('2026-11-21T10:00:00+05:30'))).toBe('2026-11-21 17:00');
    expect(parseQuick('take medicine after dinner', SAT).payload.title).toBe('Take medicine');
  });
  it('reads "9 15 am", "half past 7", "quarter to 6"', () => {
    expect(when('tomorrow 9 15 am interview with amazon', SAT)).toBe('2026-11-22 09:15');
    expect(parseQuick('tomorrow 9 15 am interview with amazon', SAT).payload.title).toBe('Interview with amazon');
    expect(when('tomorrow half past 7 pm call mom', SAT)).toBe('2026-11-22 19:30');
    expect(when('tomorrow quarter to 6 pm call mom', SAT)).toBe('2026-11-22 17:45');
    expect(when('tomorrow quarter past 3 meeting', SAT)).toBe('2026-11-22 15:15');
  });
  it('reads "tomorrows" and "tomorrow at 9" as the morning', () => {
    expect(when('bring id card for tomorrows exam at 9', SAT)).toBe('2026-11-22 09:00');
    expect(when("tomorrow's viva at 10", SAT)).toBe('2026-11-22 10:00');
    expect(when('tomorrow at 3 meeting', SAT)).toBe('2026-11-22 15:00');
  });
  it('knows which hours are am for wake-up words and pm for dinner words', () => {
    expect(parseQuick('wake up at 6 daily', SAT).payload).toMatchObject({ schedule_type: 'daily', time_of_day: '06:00', title: 'Wake up' });
    expect(when('dinner at 8 with friends', Date.parse('2026-11-21T15:00:00+05:30'))).toBe('2026-11-21 20:00');
    expect(when('dinner at 8 with friends', SAT)).toBe('2026-11-22 20:00');
    expect(when('alarm at 5', SAT)).toBe('2026-11-22 05:00');
  });
  it('uses the usual time of a sentence when only the day is given', () => {
    expect(when('call mom tomorrow', SAT)).toBe('2026-11-22 18:00');
    expect(when('dinner with rahul saturday', Date.parse('2026-11-18T10:00:00+05:30'))).toBe('2026-11-21 20:00');
    expect(when('submit lab file tomorrow', SAT)).toBe('2026-11-22 09:00');
  });
  it('offers one-tap times only when no time was said', () => {
    expect(TIME_CHIPS.map((c) => c.word)).toEqual(['morning', 'afternoon', 'evening', 'night']);
    expect(when('buy milk evening', Date.parse('2026-11-21T10:00:00+05:30'))).toBe('2026-11-21 18:00');
  });
});

describe('mistakes found by trying real sentences', () => {
  const SAT = Date.parse('2026-11-21T20:33:00+05:30');
  const at = (s) => parseQuick(s, SAT).payload;
  it('does not turn "hr" (human resources) into hours', () => {
    expect(at('send resume to hr by friday 5 pm').title).toBe('Send resume to hr');
    expect(ist(at('call mom in 2 hrs').due_date)).toBe('2026-11-21 22:33');
  });
  it('reads "at 10" in a repeat as the morning, not the next time it happens tonight', () => {
    expect(at('standup at 10 daily')).toMatchObject({ schedule_type: 'daily', time_of_day: '10:00' });
    expect(at('gym every monday at 7')).toMatchObject({ time_of_day: '07:00' });
  });
  it('drops "I have a", "really" and a trailing "please remind me"', () => {
    expect(at('i have a viva on 28th november at 10 am please remind me').title).toBe('Viva');
    expect(at('i should really start studying for the endsem exam on 5th december').title).toBe('Start studying for the endsem exam');
  });
});

describe('usual times', () => {
  const SAT = Date.parse('2026-11-21T20:33:00+05:30');
  it('is learned from a said time, after the same time twice, and only used when no time is said', () => {
    let habits = {};
    habits = learnHabit(habits, parseQuick('gym tomorrow 6am', SAT));
    expect(parseQuick('gym tomorrow', SAT, habits).found.includes('habit')).toBe(false); // once is not a habit yet
    habits = learnHabit(habits, parseQuick('gym friday 6am', SAT));
    const r = parseQuick('gym tomorrow', SAT, habits);
    expect(r.found.includes('habit')).toBe(true);
    expect(ist(r.payload.due_date)).toBe('2026-11-22 06:00');
    expect(r.assumedTime).toBe(false);
    expect(ist(parseQuick('gym tomorrow 7am', SAT, habits).payload.due_date)).toBe('2026-11-22 07:00'); // a said time always wins
    expect(habitKey('Call mom tomorrow')).toBe('call mom');
  });
  it('is not taught by a default time, and one different time starts over', () => {
    expect(learnHabit({}, parseQuick('buy milk', SAT))).toEqual({});
    let habits = learnHabit({}, parseQuick('gym 6am', SAT));
    habits = learnHabit(habits, parseQuick('gym 6am', SAT));
    habits = learnHabit(habits, parseQuick('gym 7am', SAT));
    expect(habits.gym).toEqual({ h: 7, m: 0, n: 1 });
    expect(parseQuick('gym tomorrow', SAT, habits).found.includes('habit')).toBe(false);
  });
});

describe('Indian-language sentences', () => {
  const at = (s) => parseQuick(s, NOW);
  it('understands Hindi, Marathi, Tamil and Urdu day / time words', () => {
    expect(at('कल शाम 6 बजे जिम').payload.title).toBe('जिम');
    expect(ist(at('कल शाम 6 बजे जिम').payload.due_date)).toBe('2026-10-31 18:00');
    expect(ist(at('उद्या सकाळी 7 वाजता व्यायाम').payload.due_date)).toBe('2026-10-31 07:00');
    expect(ist(at('நாளை மாலை 6 மணிக்கு ஜிம்').payload.due_date)).toBe('2026-10-31 18:00');
    expect(ist(at('کل شام 6 بجے جم').payload.due_date)).toBe('2026-10-31 18:00');
  });
  it('reads native digits and repeats', () => {
    expect(at('हर दिन सुबह ८ बजे पानी पीना').payload).toMatchObject({ schedule_type: 'daily', time_of_day: '08:00' });
  });
});
