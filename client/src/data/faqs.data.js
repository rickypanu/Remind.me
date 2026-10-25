// FAQ content (finding Q9). Plain data, no React: edit answers here without touching any component.
// The same list feeds the page, the search, and the schema.org FAQPage markup used by search engines.
//
// Each entry has: id (unique, stable), category, question, answer (plain text, no HTML), and optionally
//   steps: string[]            -> rendered as a numbered list
//   link:  { to, label }       -> rendered as a link that jumps to that page
export const FAQS = [
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

/** Categories in the order they first appear, with "All" first. */
export const FAQ_CATEGORIES = ['All', ...new Set(FAQS.map((faq) => faq.category))];
