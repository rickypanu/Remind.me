import { describe, expect, it } from 'vitest';
import { parseQuick } from './quickParse';

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
    // no date, no time: 2 hours ahead, but 10 minutes when that would cross midnight (21:58 + 2h does)
    expect(ist(run('submit report').due_date)).toBe('2026-10-30 23:58');
    const early = parseQuick('submit report', Date.parse('2026-10-30T10:00:00+05:30')).payload;
    expect(ist(early.due_date)).toBe('2026-10-30 12:00');
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
    expect(ist(run('5.75pm call').due_date)).toBe('2026-10-30 23:58'); // not a time: falls back to the default
  });

  it('never returns a weekly repeat without a weekday', () => {
    expect(run('gym every thurday 7am').weekdays).toEqual([3]);
  });

  it('waits for the next leap year for 29 Feb', () => {
    expect(ist(parseQuick('29 feb party', Date.parse('2028-03-10T10:00:00+05:30')).payload.due_date)).toBe('2032-02-29 09:00');
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

describe('title and description', () => {
  const at = (s) => parseQuick(s, NOW);
  it('splits a detail after a dash into the description', () => {
    const r = at('Submit DSA assignment tomorrow 6pm - include the report and code');
    expect(r.payload.title).toBe('Submit DSA assignment');
    expect(r.payload.description).toBe('Include the report and code');
  });
  it('splits after a colon, keeping the list in the description', () => {
    const r = at('Buy groceries: milk, eggs, bread tomorrow morning');
    expect(r.payload.title).toBe('Buy groceries');
    expect(r.payload.description).toBe('Milk, eggs, bread');
  });
  it('splits after a comma once the title has two words', () => {
    const r = at('Call dad tomorrow 8pm, ask about fees');
    expect(r.payload.title).toBe('Call dad');
    expect(r.payload.description).toBe('Ask about fees');
  });
  it('reads brackets and "about" as details', () => {
    expect(at('Pay fees by 20th (use the college portal)').payload.description).toBe('Use the college portal');
    expect(at('Meeting with Rahul at 5pm about project demo').payload.title).toBe('Meeting with Rahul');
  });
  it('does not turn a one-word list start into a title', () => {
    const r = at('milk, eggs, bread tomorrow');
    expect(r.payload.description).toBe(null);
  });
  it('keeps capitals the person typed', () => {
    expect(at('submit DSA lab file friday').payload.title).toBe('Submit DSA lab file');
  });
  it('says when the time was not given', () => {
    expect(at('buy milk').assumedTime).toBe(true);
    expect(at('buy milk tomorrow 6pm').assumedTime).toBe(false);
    expect(at('call mom in 30 min').assumedTime).toBe(false);
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
