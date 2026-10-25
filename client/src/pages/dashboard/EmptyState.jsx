import React from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

export default function EmptyState({ Icon, title, body, cta }) {
  return (
    <div className="text-center py-14 px-6 bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col items-center justify-center">
      <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3">
        <Icon size={22} strokeWidth={2} aria-hidden="true" />
      </div>
      <h3 className="text-slate-900 font-bold text-base mb-1">{title}</h3>
      <p className="text-xs text-slate-500 font-medium max-w-xs mb-4">{body}</p>
      <Link
        to="/create-task"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full shadow-sm active:scale-95 transition-all"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
        {cta}
      </Link>
    </div>
  );
}
