// Regenerates quick_parse_js_parity.json from the app's JavaScript parser. Run after ANY change to quickParse.js:
//   node make_quick_parse_fixture.mjs
// tests/test_quick_parse.py then checks that utils/quick_parse.py gives the same answer for every row.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseQuick } from '../../../../getremindme-app/src/logic/quickParse.js';

const here = dirname(fileURLToPath(import.meta.url));
const old = JSON.parse(readFileSync(join(here, 'quick_parse_js_parity.json'), 'utf8'));

const NOWS = [
  ...new Set(old.map((r) => r.now)), // the four clocks the first version used
  Date.parse('2026-11-21T20:33:00+05:30'), // Saturday evening
  Date.parse('2026-11-21T02:10:00+05:30'), // small hours
  Date.parse('2026-11-21T22:41:00+05:30'), // late night
  Date.parse('2026-11-21T10:13:00+05:30'), // morning, odd minute
];

const MORE = `submit dbms assignment on monday before 11 am
i have a viva on 28th november at 10 am please remind me
call dad tonight
buy vegetables on the way home
mujhe kal subah 6 baje uthna hai
kal raat 10 baje medicine lena hai
pay college fees by 30th november
remind me to charge my phone at 11 pm
gym every day at 6 pm
every sunday evening call grandma
meeting with sir at 4:30 pm tomorrow regarding project report
tmrw 8 am bus
parso interview at 3
need to buy a birthday gift for rahul before saturday
take a walk after dinner
water the plants every morning
i should really start studying for the endsem exam on 5th december
dont forget to submit the form
send resume to hr by friday 5 pm
doctor appointment next monday 11:30
call mom in half an hour
in 10 minutes tea
standup at 10 daily
leetcode daily 9 pm
finish report today evening
remind me to take the dog out in 2 hours
aaj sham 7 baje cricket match
raat ko 11 baje assignment submit karna hai
2 hrs baad call karna
submit lab record next friday morning
wake me up at 5:30 am tomorrow
tomorrow morning go to the bank to deposit the cheque and then collect the passbook from the counter and also ask about loan
lunch with team friday 1 pm
recharge phone
hackathon registration closes on 3rd dec at midnight
pickup parcel
reminder: electricity bill
tonight 9pm netflix
interview prep tomorrow
bring umbrella tomorrow
sunday 6 pm yoga class
remind me to submit the DBMS lab file to Prof Sharma before 5:45pm on 25th
call mom at 7:30
i have to go to the bank tomorrow morning and deposit the cheque
tonight at ten pm take the medicine
need to finish the OS assignment by next week
at 6 meeting with the team about placement drive
dont forget to pay rent on 1st of every month
mom's birthday on 3rd december buy gift
tomorrow 9 15 am interview with amazon
wake up at 6 daily
workout every day 6:30 am
assignment due in 3 days
kal subah 7 baje gym jana hai
remind me after lunch to call the plumber
take medicine before bed
send the report by end of day
tomorrow half past 7 pm call mom
tomorrow quarter to 6 pm call mom
tomorrow quarter past 3 meeting
bring id card for tomorrows exam at 9
tomorrow's viva at 10
dinner at 8 with friends
alarm at 5
call mom tomorrow
dinner with rahul saturday
tomorrow
7pm
I need to remember to bring my laptop charger and id card for tomorrows exam at 9
finish the chemistry practical file and submit it to the lab assistant before the deadline tomorrow
prepare slides for the quarterly review meeting with every department head about hiring plans
Submit DSA assignment tomorrow 6pm - include the report and code
Buy groceries: milk, eggs, bread tomorrow morning
Call dad tomorrow 8pm, ask about fees
Pay fees by 20th (use the college portal)
Meeting with Rahul at 5pm about project demo
कल शाम 6 बजे जिम
हर दिन सुबह ८ बजे पानी पीना
five min break
ek ghante baad chai
please remind me to drink water
don't forget to call the bank at 4
   `.split('\n').map((x) => x.trim()).filter(Boolean);

const texts = [...new Set([...old.map((r) => r.text), ...MORE])];
const rows = [];
for (const now of NOWS) for (const text of texts) rows.push({ text, now, r: parseQuick(text, now) });
writeFileSync(join(here, 'quick_parse_js_parity.json'), JSON.stringify(rows));
console.log(`${rows.length} rows (${texts.length} sentences x ${NOWS.length} clocks)`);
