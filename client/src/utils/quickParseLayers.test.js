import { describe, expect, it } from 'vitest';
import { parseQuick } from './quickParse';
import { fixTypos } from './typos';
import { emptyPersonal, learnCategory, pickCategory } from './categoryModel';

// Fri 30 Oct 2026, 21:58 IST. Every case below was written by hand BEFORE running it; it is the test set for the
// typo layer, the spoken-number layer and the category model.
const NOW = Date.parse('2026-10-30T21:58:00+05:30');
const ist = (iso) => new Date(Date.parse(iso) + 330 * 60000).toISOString().replace('T', ' ').slice(0, 16);

function whenOf(p) {
  if (p.schedule_type === 'daily') return `daily ${p.time_of_day}`;
  if (p.schedule_type === 'weekly') return `weekly ${p.time_of_day} ${p.weekdays.join(',')}`;
  return ist(p.due_date);
}

// [sentence, { when, title, cat }]  (any field may be left out)
const CASES = [
  // typing mistakes
  ['tmrw 6 bje gym', { when: '2026-10-31 18:00', title: 'Gym', cat: 'Extracurricular' }],
  ['thrusday evning 5 pm submit report', { when: '2026-11-05 17:00', title: 'Submit report', cat: 'Assignment' }],
  ['tomorow 7am wake up', { when: '2026-10-31 07:00' }],
  ['tommorow 5pm dentist', { when: '2026-10-31 17:00', cat: 'Personal' }],
  ['wensday 4 pm viva', { when: '2026-11-04 16:00', cat: 'Exam / Quiz' }],
  ['satarday morninng yoga', { when: '2026-10-31 09:00', cat: 'Extracurricular' }],
  ['everyday 8pm water', { when: 'daily 20:00' }],
  ['evry mnday 7am gym', { when: 'weekly 07:00 0' }],
  ['kl sham 6 bajey maths hw', { when: '2026-10-31 18:00', cat: 'Assignment' }],
  ['aaj raat 10 bje dawai', { when: '2026-10-30 22:00', cat: 'Personal' }],
  ['parson subha 7 baje train', { when: '2026-11-01 07:00', cat: 'Personal' }],
  ['30 mins baad break', { when: '2026-10-30 22:28' }],
  ['after 2 hrs submit lab file', { when: '2026-10-30 23:58', cat: 'Assignment' }],
  ['tonight 11pm movie', { when: '2026-10-30 23:00', cat: 'Personal' }],
  // numbers said in words
  ['kal paanch baje padhna', { when: '2026-10-31 17:00', cat: 'Exam / Quiz' }],
  ['dedh baje lunch tomorrow', { when: '2026-10-31 13:30', cat: 'Personal' }],
  ['saade teen baje class kal', { when: '2026-10-31 15:30' }],
  ['in five minutes call mom', { when: '2026-10-30 22:03', cat: 'Personal' }],
  ['padhai karni hai kal 4 baje', { when: '2026-10-31 16:00', cat: 'Exam / Quiz' }],
  // category from the words (rules missed these before)
  ['Badminton with Rahul tomorrow 6pm', { cat: 'Extracurricular', title: 'Badminton with Rahul' }],
  ['Study for chemisrty exam tomorrow 10am', { cat: 'Exam / Quiz' }],
  ['Deploy website tomorrow 3pm', { cat: 'Project' }],
  ['Mock interview prep tomorrow 5pm', { cat: 'Placement / Internship' }],
  ['Leetcode tomorrow 8pm', { cat: 'Placement / Internship' }],
  ['Buy vegetables tomorrow 6pm', { cat: 'Personal' }],
  ['Pay electricity bill tomorrow 11am', { cat: 'Personal' }],
  ['Finish record file tomorrow 4pm', { cat: 'Assignment' }],
  ['Water the plants tomorrow 7am', { cat: 'Personal' }],
  ['Collect the parcel tomorrow 5pm', { cat: 'Other' }],
  ['Meeting with sir tomorrow 11am', { cat: 'Other' }],
  // other languages
  ['कल शाम 6 बजे जिम', { when: '2026-10-31 18:00', title: 'जिम' }],
  ['நாளை மாலை 6 மணிக்கு ஜிம்', { when: '2026-10-31 18:00' }],
  // things that must NOT change
  ['Sundae party tomorrow 5pm', { title: 'Sundae party', when: '2026-10-31 17:00' }],
  ['Buy dairy tomorrow 5pm', { title: 'Buy dairy' }],
  ['Mourning walk tomorrow 6am', { title: 'Mourning walk', when: '2026-10-31 06:00' }],
  ['Meet Shyam tomorrow 5pm', { title: 'Meet Shyam' }],
  ['Do homework tomorrow 6pm', { title: 'Do homework', cat: 'Assignment' }],
  ['One more chapter tomorrow 8pm', { title: 'One more chapter' }],
  ['Gym every monday and thursday 7am', { when: 'weekly 07:00 0,3', title: 'Gym' }],
  ['call mom in 30 min', { when: '2026-10-30 22:28', cat: 'Personal' }],
  ['exam on 25th nov chemistry', { when: '2026-11-25 09:00', cat: 'Exam / Quiz' }],
  ['project demo 12 nov 3pm', { when: '2026-11-12 15:00', cat: 'Project' }],
  ['birthday party saturday 7pm', { when: '2026-10-31 19:00', cat: 'Personal' }],
];

describe('typo, spoken-number and category layers', () => {
  it('gets every hand-written case right', () => {
    const wrong = [];
    for (const [text, exp] of CASES) {
      const p = parseQuick(text, NOW).payload;
      const got = { when: whenOf(p), title: p.title, cat: p.category };
      for (const key of Object.keys(exp)) if (got[key] !== exp[key]) wrong.push(`${text} | ${key}: wanted ${exp[key]} got ${got[key]}`);
    }
    expect(wrong).toEqual([]);
  });

  it('repairs only date and time words', () => {
    expect(fixTypos('tmrw 6 bje gym')).toBe('tomorrow 6 baje gym');
    expect(fixTypos('thrusday evning')).toBe('thursday evening');
    expect(fixTypos('buy dairy and sundae')).toBe('buy dairy and sundae');
    expect(fixTypos('Do the thing')).toBe('Do the thing');
  });
});

describe('learning from the person', () => {
  it('uses a title the person filed before, and ignores the keyword guess', () => {
    let mine = emptyPersonal();
    expect(pickCategory('Meeting with sir', '', 'Other', mine)).toBe('Other');
    mine = learnCategory(mine, 'Meeting with sir', 'Project');
    expect(pickCategory('meeting with SIR', '', 'Other', mine)).toBe('Project');
    expect(pickCategory('Pay rent', '', 'Personal', mine)).toBe('Personal');
  });
  it('generalises after two similar examples, and keeps the other categories alone', () => {
    let mine = learnCategory(emptyPersonal(), 'Standup with sir', 'Project');
    mine = learnCategory(mine, 'Sir sync notes', 'Project');
    expect(pickCategory('Call sir about sync', '', 'Other', mine)).toBe('Project');
    expect(pickCategory('Buy vegetables', '', 'Personal', mine)).toBe('Personal');
  });
  it('never learns from an unknown category', () => {
    const mine = learnCategory(emptyPersonal(), 'Something', 'Not a category');
    expect(Object.keys(mine.titles).length).toBe(0);
  });
});
