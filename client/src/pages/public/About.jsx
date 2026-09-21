import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Server,
  BellRing,
  Code,
  LayoutDashboard,
  Mail,
  Bug,
  ExternalLink,
  Zap,
  Send,
  PlusCircle,
  Megaphone,
  ArrowRight
} from "lucide-react";

export default function About() {
  

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-800 transition-colors duration-300">
      {/* Top Navigation - Glassmorphism */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-200 px-4 py-4 transition-colors">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">About</h1>
          </div>
          {/* Live Service Status */}
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Systems Operational
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
            <span>v2.1.0</span>
            <span className="text-blue-300">•</span>
            <span>Production Release</span>
          </div>

          <p className="text-gray-600 leading-relaxed max-w-md mx-auto text-sm sm:text-base">
            Engineered to remove friction from student productivity. GetRemindMe is an automated dispatch platform that delivers real-time task alerts directly across Web Push and Telegram.
          </p>
        </div>

        {/* --- Quick App Navigation --- */}
        <div className="mb-3 px-1 flex items-center justify-between mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
            Quick Actions
          </h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link
            to="/create-task"
            className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex items-center gap-3 active:scale-[0.98] group"
          >
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-colors">
              <PlusCircle size={20} strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-gray-900 text-sm">Create Task</span>
          </Link>

          <Link
            to="/updates"
            className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-300 transition-all flex items-center gap-3 active:scale-[0.98] group"
          >
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-100 transition-colors">
              <Megaphone size={20} strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-gray-900 text-sm">See Updates</span>
          </Link>
        </div>

        {/* Feature & Architecture Grid */}
        <div className="mb-3 px-1 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
            Core Architecture
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Card 1: FastAPI */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Server size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">FastAPI Task Engine</h4>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                Asynchronous, low-latency backend handling real-time task scheduling and multi-threaded event triggers.
              </p>
            </div>
          </div>

          {/* Card 2: Multi-Channel Dispatch */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BellRing size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Omnichannel Dispatch</h4>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                Proactive alerts dispatched instantly through browser Web Push and Telegram bot webhooks.
              </p>
            </div>
          </div>

          {/* Card 3: Internal Telegram Route CTA */}
          <div className="sm:col-span-2 bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-200 p-5 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-sky-500 text-white rounded-xl shadow-md shadow-sky-500/20">
                <Send size={20} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Telegram Integration</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Receive deadline pings and add reminders on the fly directly inside Telegram.
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
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
            Project & Support
          </h3>
        </div>

        <div className="space-y-3">
          {/* Source Code */}
          <a
            href="https://github.com/rickypanu"
            target="_blank"
            rel="noopener noreferrer"
            className="group w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-gray-100 text-gray-700 rounded-xl flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <Code size={20} />
              </div>
              <div className="text-left">
                <span className="font-semibold text-gray-900 text-sm block">Source Repository</span>
                <span className="text-xs text-gray-400">Explore code, architecture, & releases on GitHub</span>
              </div>
            </div>
            <ExternalLink size={18} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </a>

          {/* Contact Developer */}
          <a
            href="mailto:rickypanu2005@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Mail size={20} />
              </div>
              <div className="text-left">
                <span className="font-semibold text-gray-900 text-sm block">Contact Developer</span>
                <span className="text-xs text-gray-400">Collaborations, inquiries, and feedback</span>
              </div>
            </div>
            <ExternalLink size={18} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </a>

          {/* Report an Issue */}
          <a
            href="mailto:rickypanu2005@gmail.com?subject=Bug%20Report%20-%20GetRemindMe%20App"
            target="_blank"
            rel="noopener noreferrer"
            className="group w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                <Bug size={20} />
              </div>
              <div className="text-left">
                <span className="font-semibold text-gray-900 text-sm block">Report an Issue</span>
                <span className="text-xs text-gray-400">File bug reports or submit feature requests</span>
              </div>
            </div>
            <ExternalLink size={18} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </a>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 mb-4">
          <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 font-medium">
            <Zap size={14} className="text-amber-500 fill-amber-500" />
            <p>Designed & Developed by Ricky Panu</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            © {new Date().getFullYear()} GetRemindMe • All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}