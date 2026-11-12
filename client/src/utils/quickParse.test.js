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
});
