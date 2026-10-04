import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText } from 'lucide-react';

const CONTACT_EMAIL = 'rickypanu2005@gmail.com';
const LAST_UPDATED = 'October 4, 2026';

// Each item: { title, body: string | string[], list?: string[] }
const termsSections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing and using RemindMe, you accept and agree to be bound by these Terms and the Privacy Policy below. If you do not agree, please do not use the service.',
  },
  {
    title: '2. Eligibility and Age',
    body: [
      'You must be at least 18 years old to use RemindMe on your own. If you are at least 13 but under 18, you may use RemindMe only with the knowledge and consent of your parent or legal guardian, who is responsible for your use of the service.',
      'By using the service, you confirm that you meet these requirements.',
    ],
  },
  {
    title: '3. Your Account',
    body: 'To use RemindMe you must register for an account. You agree to provide accurate, current and complete information and to keep it up to date. You are responsible for safeguarding your password and for all activity under your account. Tell us promptly if you suspect unauthorised access.',
  },
  {
    title: '4. Acceptable Use',
    body: 'You agree to use RemindMe only for lawful purposes. You must not:',
    list: [
      'attempt to access another user\'s account or data, or probe or disrupt the service;',
      'send spam, malware or other malicious content, or misuse notification features;',
      'overload the service, including by automated or scripted requests (for example, abusing Magic Add);',
      'upload a profile picture that is unlawful, offensive, infringes someone else\'s rights, or that you do not have the right to use.',
    ],
  },
  {
    title: '5. Notifications and Communications',
    body: 'RemindMe can send you task reminders through the channels you choose to enable:',
    list: [
      'Telegram: by connecting your account to our Telegram bot, you consent to receive automated task alerts and reminders there.',
      'Browser notifications: by clicking "Enable Alerts" and allowing notifications in your browser, you consent to receive reminders on that device.',
      'Email: we send essential account emails, such as password reset and password-changed confirmations.',
    ],
    after:
      'You can opt out at any time: unsubscribe a device with the "Subscribed" button in the top bar, disconnect Telegram from the Telegram setup page (or stop or block the bot), or turn off notifications in your browser or device settings.',
  },
  {
    title: '6. Magic Add and AI Features',
    body: [
      'Magic Add uses artificial intelligence to turn the sentence you type or speak into a task (title, due date and category). AI output can be wrong or misinterpret dates and times, so please check every task it creates.',
      'The text you enter into Magic Add is sent to a third-party AI provider for processing (see the Privacy Policy). Do not enter passwords, financial details or other sensitive personal information.',
    ],
  },
  {
    title: '7. Your Content and Profile Pictures',
    body: 'You keep ownership of the tasks, descriptions and pictures you add. You give RemindMe a limited licence to store, process and display that content solely to operate the service for you. You confirm that you have the right to use anything you upload. Built-in illustration avatars belong to their respective creators and are provided for use inside RemindMe only.',
  },
  {
    title: '8. Reminder Delivery and Service Availability',
    body: [
      'Reminders depend on systems we do not control, including Telegram, your browser vendor\'s push service, your device settings (such as Do Not Disturb or battery saver), your internet connection, and our hosting providers. Reminders can therefore be delayed, duplicated or not delivered.',
      'Reminder times are calculated in Indian Standard Time (IST). We may change, suspend or discontinue features at any time.',
    ],
  },
  {
    title: '9. Disclaimer and Limitation of Liability',
    body: 'RemindMe is provided on an "as is" and "as available" basis. We do not guarantee that notifications will be delivered on time, that Magic Add will be accurate, or that the service will be uninterrupted or error-free. To the fullest extent permitted by law, we are not liable for any missed deadlines, exams or events, financial loss, or other damages resulting from failed or late reminders, incorrect AI output, or service downtime. Please do not rely on RemindMe as your only reminder for critical deadlines.',
  },
  {
    title: '10. Account Termination',
    body: 'You may stop using RemindMe and delete your account at any time from your Profile. We may suspend or terminate your account, with or without notice, for conduct that we believe violates these Terms or is harmful to other users, us or third parties.',
  },
  {
    title: '11. Changes to These Terms',
    body: 'We may update these Terms from time to time. The "Last updated" date at the top shows when they last changed. If you keep using RemindMe after an update, you accept the revised Terms.',
  },
  {
    title: '12. Governing Law',
    body: 'These Terms are governed by and construed in accordance with the laws of India, including the Information Technology Act, 2000, without regard to conflict-of-law principles.',
  },
];

const privacySections = [
  {
    title: '1. Information We Collect',
    body: 'We collect the following information:',
    list: [
      'Account details: your name, email address and password (stored only as a secure hash, never in plain text).',
      'Task data: the titles, descriptions, categories, due dates and status of the tasks you create, including tasks created with Magic Add.',
      'Profile picture: a photo you upload (stored in our database) or the illustration you choose.',
      'Telegram details, if you connect it: your Telegram chat ID and, only if you choose to share it, your phone number.',
      'Browser notification details, if you enable alerts: a push subscription (an address and encryption keys issued by your browser) for each device you enable.',
      'Technical data: IP address and request logs, which our hosting providers process to run and secure the service.',
    ],
  },
  {
    title: '2. How We Use Your Information',
    body: 'We use your information to provide, maintain and improve RemindMe; to send the reminders you set up; to send account emails such as password resets; and to protect RemindMe and its users. We do not sell your personal data and we do not show advertising.',
  },
  {
    title: '3. Third-Party Services',
    body: 'We rely on trusted third parties, which process data only as needed to operate RemindMe:',
    list: [
      'Vercel (frontend hosting), Render (backend hosting) and MongoDB Atlas (database storage).',
      'Telegram, which delivers Telegram reminders and is subject to its own privacy policy.',
      'Brevo, which sends our account emails (password reset and password-changed confirmation).',
      'Google (Gemini API), which processes the text you enter in Magic Add to extract task details.',
      'Your browser vendor\'s push service (for example Google, Mozilla, Apple or Microsoft), which delivers browser notifications to your device.',
      'DiceBear, which serves some illustration avatars. When such an avatar is shown, your browser requests the image from DiceBear\'s servers, which can see your IP address.',
      'Your browser\'s speech recognition, if you use voice input. Depending on your browser, audio may be processed by the browser vendor. RemindMe does not receive or store your audio, only the resulting text.',
    ],
  },
  {
    title: '4. Notifications',
    body: 'Reminder text (for example, a task title) is sent through Telegram or your browser vendor\'s push service to reach you. Browser push messages are encrypted for your device. You can remove a device at any time using the "Subscribed" button, or disconnect Telegram from the Telegram setup page, which removes your stored chat ID and phone number.',
  },
  {
    title: '5. Data Retention, Your Control and Deletion',
    body: 'We keep your data while your account is active. You can delete your account and all associated personal data, including your tasks, profile picture, Telegram link and notification subscriptions, at any time by going to your Profile and choosing "Delete Account". This cannot be undone. Deleted data is removed from our active databases; copies may remain in infrastructure backups of our providers for a limited period before they are overwritten.',
  },
  {
    title: '6. Data Security',
    body: 'We use reasonable security practices to protect your information from unauthorised access, alteration, disclosure or destruction, including storing passwords as secure hashes and using encrypted connections, in line with applicable Indian laws. However, no method of transmission or storage over the internet is completely secure or error-free.',
  },
  {
    title: '7. Cookies, Local Storage and Offline Cache',
    body: 'We use your browser\'s local storage to keep you logged in and to remember small preferences, and a service worker to cache app files for faster loading and to deliver notifications. We do not use advertising or tracking cookies and we do not run third-party analytics.',
  },
  {
    title: '8. Children',
    body: 'RemindMe is not intended for children under 13, and we do not knowingly collect their data. Users aged 13 to 17 may use RemindMe only with the consent of a parent or legal guardian. If you believe a child has used RemindMe without appropriate consent, contact us and we will delete the account.',
  },
  {
    title: '9. Your Rights and Grievance Officer',
    body: `Under the Digital Personal Data Protection Act, 2023 (DPDPA) and the Information Technology Act, 2000, you have the right to access, correct and erase your personal data and to withdraw your consent. You can edit your name and profile picture in your Profile, and delete your account at any time. For any request or grievance about your data or privacy, contact our Grievance Officer at ${CONTACT_EMAIL}.`,
  },
  {
    title: '10. Changes to This Policy',
    body: 'We may update this Privacy Policy as RemindMe changes. The "Last updated" date shows the latest revision, and we will make reasonable efforts to inform you of material changes.',
  },
  {
    title: '11. Contact Us',
    body: `If you have any questions about these Terms or our Privacy Policy, please contact us at ${CONTACT_EMAIL}.`,
  },
];

function Block({ section }) {
  const paragraphs = Array.isArray(section.body) ? section.body : [section.body];
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{section.title}</h3>
      <div className="space-y-3">
        {paragraphs.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        {section.list && (
          <ul className="list-disc pl-5 space-y-1.5 marker:text-blue-400">
            {section.list.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
        {section.after && <p>{section.after}</p>}
      </div>
    </div>
  );
}

export default function Terms() {
  const navigate = useNavigate();

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Main Container - Keeps everything centered and aligned */}
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="w-fit mb-6 flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-8 py-10 text-center text-white">
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Legal &amp; Privacy</h1>
            <p className="text-blue-100 font-medium">Last updated: {LAST_UPDATED}</p>
          </div>

          {/* Content Body */}
          <div className="p-8 sm:p-12 space-y-12 text-gray-700">
            {/* Quick jump links */}
            <nav className="flex flex-wrap gap-3 text-sm font-semibold">
              <a
                href="#terms"
                className="px-4 py-2 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Terms of Service
              </a>
              <a
                href="#privacy"
                className="px-4 py-2 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Privacy Policy
              </a>
            </nav>

            {/* Terms of Service Section */}
            <section id="terms" className="scroll-mt-6">
              <div className="flex items-center gap-3 mb-6 border-b pb-4">
                <FileText className="text-blue-600" size={28} />
                <h2 className="text-2xl font-bold text-gray-900">Terms of Service</h2>
              </div>
              <div className="space-y-6 text-sm leading-relaxed">
                {termsSections.map((section) => (
                  <Block key={section.title} section={section} />
                ))}
              </div>
            </section>

            {/* Privacy Policy Section */}
            <section id="privacy" className="scroll-mt-6">
              <div className="flex items-center gap-3 mb-6 border-b pb-4">
                <Shield className="text-blue-600" size={28} />
                <h2 className="text-2xl font-bold text-gray-900">Privacy Policy</h2>
              </div>
              <div className="space-y-6 text-sm leading-relaxed">
                {privacySections.map((section) => (
                  <Block key={section.title} section={section} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}