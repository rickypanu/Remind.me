import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

export default function RegisterSuccess() {
  return (
    <div className="text-center py-6" role="status">
      <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
        <Check size={32} strokeWidth={3} aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-extrabold text-[color:var(--rm-ink)] tracking-tight">You're all set</h1>
      <p className="mt-2 text-slate-600 font-medium">Account created. Taking you to login…</p>
      <div className="mt-6 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
        <div className="rm-fill h-full rounded-full bg-emerald-500" />
      </div>
      <Link
        to="/login"
        className="mt-6 inline-flex items-center justify-center gap-2 w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
      >
        Log in now <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  );
}
