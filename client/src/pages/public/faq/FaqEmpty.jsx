import React from "react";
import { MessageCircleQuestion } from "lucide-react";

export default function FaqEmpty({ query, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
        <MessageCircleQuestion className="w-8 h-8 text-slate-500" aria-hidden="true" />
      </div>
      <h3 className="text-slate-900 font-bold text-lg mb-1">No results found</h3>
      <p className="text-slate-600 text-sm max-w-sm mb-5">
        We couldn&apos;t find any FAQs matching &ldquo;{query}&rdquo;. Try different words or another category.
      </p>
      <button type="button" onClick={onReset} className="text-sm font-bold text-indigo-700 hover:text-indigo-800 transition-colors">
        Reset search
      </button>
    </div>
  );
}
