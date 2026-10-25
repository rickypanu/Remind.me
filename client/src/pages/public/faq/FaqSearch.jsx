import React from "react";
import { Search, X } from "lucide-react";

export default function FaqSearch({ value, onChange, onClear }) {
  return (
    <div className="relative group" role="search">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" aria-hidden="true" />
      </div>
      <input
        type="search"
        aria-label="Search the FAQs"
        placeholder="Search for answers..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full pl-11 pr-11 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute inset-y-0 right-3 my-auto h-8 w-8 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
