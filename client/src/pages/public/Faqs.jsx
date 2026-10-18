import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  Search,
  X,
  MessageCircleQuestion,
  Mail,
  Rocket,
  ListTodo,
  BellRing,
  UserCog,
  SlidersHorizontal,
  ThumbsUp,
  ThumbsDown,
  LayoutGrid,
} from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import PageHeader from '../../components/PageHeader';
import usePageMeta from '../../utils/usePageMeta';
import { mailto } from '../../config/site';

const SUPPORT_MAILTO = mailto('Support Request - RemindMe');

// Each FAQ can optionally have:
//   steps: string[]            -> rendered as a numbered list
//   link:  { to, label }       -> rendered as a button that jumps to that page
const faqData = [
  // ---------------- Getting Started ----------------
  {
    id: 1,
    category: 'Getting Started',
    question: 'What is RemindMe?',
    answer:
      'RemindMe sends you reminders at the right time: a specific date and time, every day, or on chosen days every week. Add assignments, projects, exams, habits or routines, and we remind you through Telegram and browser notifications.',
  },
  {
    id: 2,
    category: 'Getting Started',
    question: 'Is this application free to use?',
    answer:
      'Yes! Task tracking, Magic Add, Telegram alerts, browser notifications and syncing across devices are all completely free.',
  },
  {
    id: 3,
    category: 'Getting Started',
    question: 'Can I install it like an app on my phone?',
    answer:
      'Yes. RemindMe is a web app that you can add to your home screen, so it opens full-screen like a normal app.',
    steps: [
      'Android (Chrome): tap the ⋮ menu, then "Install app" or "Add to Home screen".',
      'iPhone (Safari): tap the Share button, then "Add to Home Screen".',
      'Desktop (Chrome / Edge): click the install icon at the right end of the address bar.',
    ],
  },
  {
    id: 4,
    category: 'Getting Started',
    question: 'Will my schedule sync across my phone and laptop?',
    answer:
      'Yes. Your tasks live in your account, not on one device. Add a task on your laptop during class and tick it off from your phone later, just log in with the same account. Changes made while you are offline are kept on your device and sync automatically when the connection returns.',
  },

  // ---------------- Tasks ----------------
  {
    id: 5,
    category: 'Tasks',
    question: 'How do I add a task?',
    answer:
      'There are two ways. Use the "New reminder" button (the + button on a phone) to fill in the title, notes, category and schedule yourself, or use Magic Add on the dashboard to just type or speak a sentence. The Magic Add box grows as you type or speak, so you can always read the whole sentence before you send it with Enter.',
    link: { to: '/create-task', label: 'Create a task' },
  },
  {
    id: 6,
    category: 'Tasks',
    question: 'What is Magic Add and how do I get the best results?',
    answer:
      'Magic Add reads a normal sentence, like "Submit DBMS assignment tomorrow 5pm", and fills in the title, deadline and category for you using AI. Mention the day and time to get an accurate deadline, and check the new task on your dashboard afterwards. Task titles are saved in English.',
  },
  {
    id: 26,
    category: 'Tasks',
    question: 'How do daily and weekly reminders work?',
    answer:
      'When you create a reminder, choose "Specific date", "Every day" or "Every week". Daily and weekly reminders need a time (and, for weekly, the days you want). When you tick one off, it moves to its next occurrence automatically, and you keep getting reminded until you delete it or its end date passes. Magic Add understands phrases like "gym every Monday and Thursday at 7am".',
    link: { to: '/create-task', label: 'Create a reminder' },
  },
  {
    id: 7,
    category: 'Tasks',
    question: 'Why does voice input not work for me?',
    answer:
      'Voice input uses your browser\'s speech recognition, which is not available in every browser. It works best in Chrome and Edge, and you need to allow microphone access when asked. If it still fails, just type your sentence instead.',
  },
  {
    id: 8,
    category: 'Tasks',
    question: 'Can I separate homework from major exams?',
    answer:
      'Yes. Every task has a category: Assignment, Project, Exam / Quiz, Placement / Internship, Extracurricular or Personal. Pick "Other" to write your own category.',
  },
  {
    id: 9,
    category: 'Tasks',
    question: 'How is my dashboard organised?',
    answer:
      'Tasks due today appear in the Today tab and later ones in Upcoming. Pending tasks whose date has passed are marked as missed, and finished tasks move to the Completed section, which you can sort.',
  },
  {
    id: 10,
    category: 'Tasks',
    question: 'How do I complete, undo or delete a task?',
    answer:
      'Tap the circle on a task card to mark it complete. Tap it again to move it back to pending. For a daily or weekly reminder, ticking it off finishes only that occurrence and schedules the next one. Use the pencil icon on a card to edit it, and the bin icon to delete it (for a repeating reminder this stops the whole series). Both ask you to confirm or save in a pop-up.',
  },
  {
    id: 11,
    category: 'Tasks',
    question: 'What happens if I miss an alert?',
    answer:
      'Don\'t stress. Any task that is past its due date and not completed stays visible on your dashboard as missed until you mark it complete or delete it.',
  },

  // ---------------- Notifications ----------------
  {
    id: 12,
    category: 'Notifications',
    question: 'Which reminders will I get?',
    answer:
      'For every task that is not completed, you get a heads-up about 1 hour before it is due (plus short reminders at 10 minutes and 1 minute), a summary of your tasks for today, and an evening heads-up about tomorrow\'s tasks. Daily and weekly reminders repeat on their schedule. Completed tasks never trigger reminders.',
  },
  {
    id: 13,
    category: 'Notifications',
    question: 'Telegram or browser notifications: which should I use?',
    answer:
      'You can use both. Telegram arrives through the Telegram app, so it does not depend on browser settings and works well on your phone. Browser notifications are handy on your laptop or phone browser. Using both means you are very unlikely to miss anything.',
  },
  {
    id: 14,
    category: 'Notifications',
    question: 'How do I connect Telegram?',
    answer: 'It takes less than a minute.',
    steps: [
      'Open your Profile, choose "Notifications", then "Telegram alerts".',
      'Tap "Connect Telegram". This opens our official bot in Telegram.',
      'Press Start in the chat. Your account is linked instantly.',
      'Optional but recommended: share your phone number when the bot asks.',
    ],
    link: { to: '/telegram-setup', label: 'Set up Telegram' },
  },
  {
    id: 15,
    category: 'Notifications',
    question: 'How do I turn on browser notifications?',
    answer:
      'Open Profile, then Notifications, and press "Turn on alerts on this device" (the "Turn on alerts" button in the top bar does the same). Press Allow when your browser asks. This is set up per device, so enable it on each phone or laptop where you want alerts.',
    link: { to: '/notifications', label: 'Open Notifications' },
  },
  {
    id: 16,
    category: 'Notifications',
    question: 'I enabled alerts but I am not getting notifications. What should I check?',
    answer: 'Go through these in order:',
    steps: [
      'Make sure notifications are Allowed for this site in your browser or phone settings (not Blocked).',
      'Check that Do Not Disturb, Focus mode or battery saver is not silencing your browser.',
      'On a laptop, your browser needs to be running in the background to receive alerts.',
      'Turn alerts off and on again from the Notifications page to refresh the connection.',
      'On iPhone, notifications only work once the site is added to your Home Screen (see the next question).',
    ],
  },
  {
    id: 17,
    category: 'Notifications',
    question: 'Do browser notifications work on iPhone?',
    answer:
      'Yes, but only on iOS 16.4 or newer and only after you add RemindMe to your Home Screen. Open the app from that Home Screen icon, then turn on alerts. Notifications will not work from a normal Safari tab.',
    steps: [
      'Open the site in Safari and tap the Share button.',
      'Choose "Add to Home Screen".',
      'Open RemindMe from the new Home Screen icon.',
      'Turn on alerts and allow notifications.',
    ],
  },
  {
    id: 18,
    category: 'Notifications',
    question: 'Do I need the app open to get reminders?',
    answer:
      'No. Reminders are sent from our server, so you do not need RemindMe open. For Telegram you just need the Telegram app. Browser notifications can arrive even when the tab is closed.',
  },
  {
    id: 19,
    category: 'Notifications',
    question: 'What time zone are reminders based on?',
    answer:
      'All reminder times are calculated in Indian Standard Time (IST). If you enter a due date without a time zone, it is treated as IST.',
  },
  {
    id: 20,
    category: 'Notifications',
    question: 'How do I stop notifications?',
    answer:
      'For browser alerts, open Profile, then Notifications, and turn alerts off (or click "Alerts on" in the top bar). This only turns off alerts for the device you are using. For Telegram, open Telegram alerts from the same page and disconnect.',
    link: { to: '/notifications', label: 'Notification settings' },
  },

  // ---------------- Settings & Offline ----------------
  {
    id: 29,
    category: 'Tasks',
    question: 'How do I edit a reminder?',
    answer: 'You can change the title, notes, category and time of any pending reminder.',
    steps: [
      'Find the reminder on your dashboard.',
      'Tap the pencil icon on its card. A pop-up opens.',
      'Change what you need and press \"Save changes\".',
    ],
  },
  {
    id: 30,
    category: 'Settings & Offline',
    question: 'Does RemindMe work without internet?',
    answer:
      'Yes. After you have opened RemindMe once while online, the app loads and every page works offline. You can add, edit, complete and delete reminders; they are saved on your device first and a small "Not synced" label shows until they are uploaded. When you are back online the app syncs automatically and shows "Changes saved to cloud". Magic Add, Telegram and browser alerts need a connection, because they are handled by our server.',
  },
  {
    id: 31,
    category: 'Settings & Offline',
    question: 'What happens to offline changes if I log out?',
    answer:
      'If some changes have not been uploaded yet, RemindMe tries to upload them first and warns you before logging you out. Logging out clears the copy stored on that device, so reconnect and let the sync finish before you log out.',
  },
  {
    id: 32,
    category: 'Settings & Offline',
    question: 'How do I change the sound and vibration?',
    answer:
      'Open Profile, then Notifications. You can turn sound effects and haptic vibration on or off, pick one of five built-in alert sounds, or keep your device default. Vibration depends on your browser: it works on most Android phones but is not available on iPhone or iPad.',
    link: { to: '/notifications', label: 'Sound and vibration' },
  },
  {
    id: 33,
    category: 'Settings & Offline',
    question: 'Can I use my own notification sound?',
    answer:
      'Yes. On the Notifications page choose "Upload your own" and pick an .mp3 or .wav file (up to 2 MB and 30 seconds). Your sound plays when an alert arrives while RemindMe is open. When the app is closed, browsers only allow your device\'s own notification sound, so you will hear that one instead.',
    link: { to: '/notifications', label: 'Choose a sound' },
  },
  {
    id: 34,
    category: 'Settings & Offline',
    question: 'How do I change the theme and colours?',
    answer:
      'Open Profile and look at Appearance. Turn Dark mode on or off, and choose an accent colour: Blue, Indigo, Violet, Pink, Orange, Green or Teal. Choosing Black switches to the Minimalism theme, a flat black-and-white look. Your choice is saved on that device.',
    link: { to: '/profile', label: 'Open Appearance' },
  },

  // ---------------- Account & Privacy ----------------
  {
    id: 21,
    category: 'Account & Privacy',
    question: 'How do I change my profile picture?',
    answer:
      'Open your Profile and tap your picture. You can upload a photo from your device (up to 2 MB) or choose from the built-in illustrations, including a Dev Icons set.',
    link: { to: '/profile', label: 'Go to profile' },
  },
  {
    id: 22,
    category: 'Account & Privacy',
    question: 'I forgot my password. What do I do?',
    answer:
      'Use "Forgot password" on the login page and enter your email. If an account exists, we send you a reset link. If the link has expired, just request a new one.',
    link: { to: '/forgot-password', label: 'Reset password' },
  },
  {
    id: 23,
    category: 'Account & Privacy',
    question: 'What personal data do you store?',
    answer:
      'Your name, email and password (stored securely hashed), your reminders (title, notes and category are encrypted), and your profile picture. If you connect Telegram we store your chat ID, and your phone number only if you choose to share it. For browser alerts we store a notification address for each device you enable. Read our Terms for the full details.',
    link: { to: '/terms', label: 'Read the Terms' },
  },
  {
    id: 27,
    category: 'Account & Privacy',
    question: 'Are my reminders private?',
    answer:
      'Yes. The title, notes and category of every reminder are encrypted before they are saved, with a separate key for each user, so the database only holds unreadable ciphertext. They are decrypted only for you after you log in, and briefly on our server to deliver your own notifications. Reminders made with the form are never sent to an AI service; text you type into Magic Add is sent to Google Gemini to be understood.',
    link: { to: '/terms', label: 'Read the Privacy Policy' },
  },
  {
    id: 28,
    category: 'Tasks',
    question: 'Why was my reminder rejected?',
    answer:
      'To keep RemindMe safe for everyone, reminders are screened automatically. Text containing sexual, vulgar, hateful or harmful content is not saved. Reword it and try again. If you think a normal reminder was blocked by mistake, contact support and tell us the exact wording.',
  },
  {
    id: 24,
    category: 'Account & Privacy',
    question: 'How do I delete my account?',
    answer:
      'Open your Profile and use "Delete Account". This permanently removes your account and your tasks, and it cannot be undone.',
    link: { to: '/profile', label: 'Go to profile' },
  },
  {
    id: 25,
    category: 'Account & Privacy',
    question: 'Where can I see new features?',
    answer:
      'Announcements about new features and fixes are posted on the Updates page.',
    link: { to: '/updates', label: 'See updates' },
  },
];

const CATEGORY_ICONS = {
  All: LayoutGrid,
  'Getting Started': Rocket,
  Tasks: ListTodo,
  Notifications: BellRing,
  'Settings & Offline': SlidersHorizontal,
  'Account & Privacy': UserCog,
};

const categories = ['All', ...new Set(faqData.map((faq) => faq.category))];

const countFor = (category) =>
  category === 'All'
    ? faqData.length
    : faqData.filter((faq) => faq.category === category).length;

// Highlights the searched words inside a piece of text
function Highlight({ text, query }) {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="bg-indigo-100 text-indigo-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function FAQ() {
  usePageMeta({
    title: 'FAQs & Help',
    description:
      'Answers about RemindMe: daily, weekly and one-time reminders, Magic Add, Telegram and browser notifications, privacy and your account.',
  });
  const [openId, setOpenId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [feedback, setFeedback] = useState({}); // { [faqId]: 'up' | 'down' }

  const toggleFAQ = (id) => setOpenId(openId === id ? null : id);

  const filteredFAQs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqData.filter((faq) => {
      const matchesSearch =
        !q ||
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        (faq.steps || []).some((s) => s.toLowerCase().includes(q));
      const matchesCategory =
        activeCategory === 'All' || faq.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  const clearSearch = () => {
    setSearchQuery('');
    setOpenId(null);
  };

  return (
    <PublicLayout>
    <div className="pt-6 sm:pt-8 pb-16 px-4 sm:px-6 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-3xl mx-auto space-y-8">
        <PageHeader
          backTo
          title="How can we help?"
          subtitle="Answers about reminders, offline use, notifications, themes and your account."
        />

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search for answers..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpenId(null);
            }}
            className="w-full pl-11 pr-11 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute inset-y-0 right-3 my-auto h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => {
            const Icon = CATEGORY_ICONS[category] || LayoutGrid;
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setOpenId(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {category}
                <span
                  className={`text-[11px] rounded-full px-1.5 py-0.5 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {countFor(category)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Result count when searching */}
        {searchQuery.trim() && filteredFAQs.length > 0 && (
          <p className="text-sm text-slate-500 font-medium -mt-4">
            {filteredFAQs.length} result{filteredFAQs.length === 1 ? '' : 's'} for
            &ldquo;{searchQuery.trim()}&rdquo;
          </p>
        )}

        {/* FAQ List */}
        <div className="space-y-3 min-h-[300px]">
          {filteredFAQs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <MessageCircleQuestion className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-slate-900 font-bold text-lg mb-1">No results found</h3>
              <p className="text-slate-500 text-sm max-w-sm mb-5">
                We couldn&apos;t find any FAQs matching &ldquo;{searchQuery}&rdquo;. Try
                different words or another category.
              </p>
              <button
                onClick={() => {
                  clearSearch();
                  setActiveCategory('All');
                }}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Reset search
              </button>
            </div>
          ) : (
            filteredFAQs.map((faq) => {
              const isOpen = openId === faq.id;
              const panelId = `faq-panel-${faq.id}`;
              const CatIcon = CATEGORY_ICONS[faq.category] || LayoutGrid;

              return (
                <div
                  key={faq.id}
                  className={`bg-white rounded-2xl border transition-colors duration-200 overflow-hidden ${
                    isOpen
                      ? 'border-indigo-200 shadow-md shadow-indigo-100/50'
                      : 'border-slate-200 shadow-sm hover:border-slate-300'
                  }`}
                >
                  <button
                    onClick={() => toggleFAQ(faq.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="w-full px-5 py-4 sm:px-6 sm:py-5 flex justify-between items-center gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 group"
                  >
                    <div className="text-left min-w-0">
                      {activeCategory === 'All' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-500 mb-1">
                          <CatIcon className="w-3 h-3" />
                          {faq.category}
                        </span>
                      )}
                      <span className="block font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        <Highlight text={faq.question} query={searchQuery} />
                      </span>
                    </div>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                        isOpen
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'
                      }`}
                    >
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-300 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Smooth accordion animation using CSS grid */}
                  <div
                    id={panelId}
                    role="region"
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 pb-5 sm:px-6 sm:pb-6 border-t border-slate-50 mt-2 pt-4 space-y-4">
                        <p className="text-slate-600 text-sm leading-relaxed">
                          <Highlight text={faq.answer} query={searchQuery} />
                        </p>

                        {faq.steps && (
                          <ol className="space-y-2.5">
                            {faq.steps.map((step, i) => (
                              <li key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                                <span className="w-6 h-6 shrink-0 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">
                                  {i + 1}
                                </span>
                                <span>
                                  <Highlight text={step} query={searchQuery} />
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          {faq.link ? (
                            <Link
                              to={faq.link.to}
                              className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                            >
                              {faq.link.label}
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          ) : (
                            <span />
                          )}

                          {/* Was this helpful? (stored locally in this session only) */}
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                            {feedback[faq.id] ? (
                              <span className="text-slate-500">Thanks for your feedback!</span>
                            ) : (
                              <>
                                <span>Was this helpful?</span>
                                <button
                                  onClick={() => setFeedback((f) => ({ ...f, [faq.id]: 'up' }))}
                                  aria-label="Yes, this was helpful"
                                  className="p-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                                >
                                  <ThumbsUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setFeedback((f) => ({ ...f, [faq.id]: 'down' }))}
                                  aria-label="No, this was not helpful"
                                  className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                >
                                  <ThumbsDown className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Support CTA */}
        <div className="mt-12 bg-indigo-50 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 border border-indigo-100">
          <div>
            <h3 className="text-indigo-900 font-bold text-lg mb-1">Still have questions?</h3>
            <p className="text-indigo-700/80 text-sm font-medium">
              Can&apos;t find the answer you&apos;re looking for? Reach out and we&apos;ll get back to you.
            </p>
          </div>
          <a
            href={SUPPORT_MAILTO}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto justify-center shrink-0"
          >
            <Mail className="w-4 h-4" />
            Contact Support
          </a>
        </div>
      </div>
    </div>
    </PublicLayout>
  );
}