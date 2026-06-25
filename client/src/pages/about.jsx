import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info, Heart, ShieldCheck, Code, LayoutDashboard } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">About</h1>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 mt-8">
        
        {/* Header Section */}
        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm mb-6 text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg rotate-3 hover:rotate-0 transition-transform">
            <LayoutDashboard  size={24} />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Remind<span className="text-blue-600">Me</span>
          </h2>
          <p className="text-gray-500 font-medium">Version 1.0.0</p>
          <p className="text-gray-600 mt-4 leading-relaxed">
            Your personal hub for staying on track. Designed with simplicity and focus in mind, helping you manage your daily tasks without the clutter.
          </p>
        </div>

        {/* Features/Values Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-start gap-4">
            <div className="p-2 bg-red-50 text-red-500 rounded-lg shrink-0">
              <Heart size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Crafted with Care</h3>
              <p className="text-sm text-gray-500 mt-1">Built to provide a seamless and distraction-free user experience.</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-start gap-4">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Secure Data</h3>
              <p className="text-sm text-gray-500 mt-1">Your reminders and personal data are safely stored and protected.</p>
            </div>
          </div>
        </div>

        {/* Links Section */}
        <div className="space-y-3">
          <a 
            href="https://github.com/rickypanu" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center">
                {/* Inline SVG replacing the removed Lucide Github icon */}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"/>
                </svg>
              </div>
              <span className="font-semibold text-gray-800">Source Code</span>
            </div>
            <Code size={18} className="text-gray-400" />
          </a>
        </div>

        <div className="text-center mt-12 text-sm text-gray-400 font-medium">
          <p>© {new Date().getFullYear()} RemindMe App.</p>
          <p>All rights reserved.</p>
        </div>

      </main>
    </div>
  );
}