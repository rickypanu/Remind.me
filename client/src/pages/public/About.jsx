import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Server,
  BellRing,
  Sparkles,
  Smartphone,
  Code,
  LayoutDashboard,
  Mail,
  Bug,
  ExternalLink,
  Zap,
  Send,
  PlusCircle,
  Megaphone,
  MessageCircleQuestion,
  Shield,
} from "lucide-react";

const APP_VERSION = "v3.1.1";
const REPO_URL = "https://github.com/rickypanu/Remind.me";
const CONTACT_EMAIL = "rickypanu2005@gmail.com";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

// ---- Live service status (pings the backend's /health endpoint) ----
const STATUS_UI = {
  checking: { label: "Checking status…", wrap: "bg-gray-50 border-gray-200 text-gray-600", dot: "bg-gray-400", ping: false },
  waking: { label: "Waking up server…", wrap: "bg-amber-50 border-amber-200 text-amber-700", dot: "bg-amber-500", ping: true, pingColor: "bg-amber-400" },
  ok: { label: "Systems Operational", wrap: "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-500", ping: true, pingColor: "bg-emerald-400" },
  down: { label: "Service Unreachable", wrap: "bg-red-50 border-red-200 text-red-700", dot: "bg-red-500", ping: false },
};

function useServiceStatus() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    // Free hosting can sleep; if the first reply is slow, say the server is waking up
    const slowTimer = setTimeout(() => !cancelled && setStatus((s) => (s === "checking" ? "waking" : s)), 5000);
    const abortTimer = setTimeout(() => controller.abort(), 45000);

    fetch(`${API_BASE}/health`, { signal: controller.signal })
      .then((res) => !cancelled && setStatus(res.ok ? "ok" : "down"))
      .catch(() => !cancelled && setStatus("down"))
      .finally(() => {
        clearTimeout(slowTimer);
        clearTimeout(abortTimer);
      });

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      controller.abort();
    };
  }, []);

  return status;
}

// ---- Content ----
const features = [
  {
    icon: Sparkles,
    tone: "bg-purple-50 text-purple-600",
    title: "Magic Add (AI)",
    text: "Type or speak a sentence like “DBMS assignment tomorrow 5pm” and AI fills in the title, deadline and category for you.",
  },
  {
    icon: BellRing,
    tone: "bg-blue-50 text-blue-600",
    title: "Multi-Channel Reminders",
    text: "Get a heads-up about an hour before each deadline, plus daily summaries, through browser Web Push and Telegram.",
  },
  {
    icon: Server,
    tone: "bg-indigo-50 text-indigo-600",
    title: "FastAPI Task Engine",
    text: "An asynchronous Python backend with scheduled jobs and MongoDB, built to deliver reminders on time.",
  },
  {
    icon: Smartphone,
    tone: "bg-emerald-50 text-emerald-600",
    title: "Installable Web App",
    text: "Add RemindMe to your home screen and use it like a native app on your phone or laptop, synced across devices.",
  },
];



const quickActions = [
  { to: "/create-task", label: "Create Task", icon: PlusCircle, tone: "bg-blue-50 text-blue-600 group-hover:bg-blue-100", hover: "hover:border-blue-300" },
  { to: "/updates", label: "See Updates", icon: Megaphone, tone: "bg-purple-50 text-purple-600 group-hover:bg-purple-100", hover: "hover:border-purple-300" },
  { to: "/faqs", label: "Help & FAQs", icon: MessageCircleQuestion, tone: "bg-amber-50 text-amber-600 group-hover:bg-amber-100", hover: "hover:border-amber-300" },
  { to: "/terms", label: "Terms & Privacy", icon: Shield, tone: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100", hover: "hover:border-emerald-300" },
];

const supportLinks = [
  {
    href: REPO_URL,
    external: true,
    icon: Code,
    tone: "bg-gray-100 text-gray-700 group-hover:bg-gray-200",
    title: "Source Repository",
    text: "Explore code, architecture, & releases on GitHub",
  },
  {
    href: `mailto:${CONTACT_EMAIL}`,
    icon: Mail,
    tone: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
    title: "Contact Developer",
    text: "Collaborations, inquiries, and feedback",
  },
  {
    href: `mailto:${CONTACT_EMAIL}?subject=Bug%20Report%20-%20GetRemindMe%20App`,
    icon: Bug,
    tone: "bg-orange-50 text-orange-500 group-hover:bg-orange-100",
    title: "Report an Issue",
    text: "File bug reports or submit feature requests",
  },
];

export default function About() {
  const navigate = useNavigate();
  const status = useServiceStatus();
  const ui = STATUS_UI[status];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-800 transition-colors duration-300">
      {/* Top Navigation - Glassmorphism */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-200 px-4 py-4 transition-colors">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-900">About</h1>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header Hero Card */}
        <div className="relative overflow-hidden bg-white p-8 rounded-3xl border border-gray-200 shadow-sm mb-6 text-center group transition-colors">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400"></div>

          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-500/25 group-hover:rotate-6 transition-transform duration-300">
            <LayoutDashboard size={28} strokeWidth={2.5} />
          </div>

          <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
            Get<span className="text-blue-600">RemindMe</span>
          </h2>

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full mb-4 border border-blue-200/60">
            <span>{APP_VERSION}</span>
            <span className="text-blue-300">•</span>
            <span>Production Release</span>
          </div>

          <p className="text-gray-600 leading-relaxed max-w-md mx-auto text-sm sm:text-base">
            Built to remove friction from student productivity. GetRemindMe is a smart task and deadline tracker that
            sends reminders through Web Push and Telegram, and lets you add tasks just by typing or speaking.
          </p>
        </div>

        {/* --- Quick App Navigation --- */}
        <div className="mb-3 px-1 flex items-center justify-between mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Quick Actions</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {quickActions.map(({ to, label, icon: Icon, tone, hover }) => (
            <Link
              key={to}
              to={to}
              className={`bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md ${hover} transition-all flex items-center gap-3 active:scale-[0.98] group`}
            >
              <div className={`p-2.5 rounded-xl transition-colors ${tone}`}>
                <Icon size={20} strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-gray-900 text-sm">{label}</span>
            </Link>
          ))}
        </div>

        {/* Features Grid */}
        <div className="mb-3 px-1 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">What&apos;s Inside</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {features.map(({ icon: Icon, tone, title, text }) => (
            <div
              key={title}
              className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${tone}`}>
                <Icon size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{title}</h4>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}

          {/* Telegram CTA */}
          <div className="sm:col-span-2 bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-200 p-5 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-sky-500 text-white rounded-xl shadow-md shadow-sky-500/20">
                <Send size={20} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Telegram Reminders</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Get deadline pings straight to the Telegram app, even when the website is closed.
                </p>
              </div>
            </div>
            <Link
              to="/telegram-setup"
              className="shrink-0 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              Setup Now <ArrowRight size={13} />
            </Link>
          </div>
        </div>

  
        {/* Links & Resources */}
        <div className="mb-3 px-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Project &amp; Support</h3>
        </div>

        <div className="space-y-3">
          {supportLinks.map(({ href, external, icon: Icon, tone, title, text }) => (
            <a
              key={title}
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl flex items-center justify-center transition-colors ${tone}`}>
                  <Icon size={20} />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-gray-900 text-sm block">{title}</span>
                  <span className="text-xs text-gray-400">{text}</span>
                </div>
              </div>
              <ExternalLink size={18} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
            </a>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 mb-4">
          <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 font-medium">
            <Zap size={14} className="text-amber-500 fill-amber-500" />
            <p>Designed &amp; Developed by Ricky Panu</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            © {new Date().getFullYear()} GetRemindMe • All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}