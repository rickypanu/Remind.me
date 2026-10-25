import React, { useRef } from "react";
import { Calendar } from "lucide-react";

/**
 * Calendar icon next to the Today / Upcoming tabs. It opens the browser's own date picker (accessible, localised,
 * works on phones); picking a day reports it as "YYYY-MM-DD", read as an IST calendar day. The date input is a
 * hidden helper placed under the button so the picker opens beside it.
 */
export default function DateFilterButton({ value, label, onChange }) {
  const inputRef = useRef(null);

  const open = () => {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus(); // browsers without showPicker(): focusing + clicking opens it
      input.click();
    }
  };

  return (
    <div className="relative shrink-0 self-stretch">
      <button
        type="button"
        onClick={open}
        aria-pressed={Boolean(value)}
        aria-label={value ? `Filtering reminders by ${label}. Change date` : "Filter reminders by date"}
        title="Pick a date"
        className={`h-full min-w-[52px] px-3 rounded-2xl border flex items-center justify-center shadow-inner transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          value
            ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
            : "bg-slate-200/60 border-transparent text-slate-600 hover:text-slate-900"
        }`}
      >
        <Calendar size={19} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value || ""}
        onChange={(event) => onChange(event.target.value || null)}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  );
}
