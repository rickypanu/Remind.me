import React from "react";

/**
 * Today / Upcoming switcher. WAI-ARIA tabs: only the selected tab is in the tab order and the arrow keys move
 * between tabs. `panelId` is the id of the element that shows the selected list.
 */
export default function DashboardTabs({ tabs, active, onChange, panelId }) {
  const move = (event, index) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <div role="tablist" aria-label="Reminder lists" className="p-1.5 bg-slate-200/60 backdrop-blur-md rounded-2xl grid grid-cols-2 gap-1.5 shadow-inner">
      {tabs.map((tab, index) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive || (active == null && index === 0) ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => move(event, index)}
            className={`w-full py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Icon size={17} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" className={isActive ? "text-blue-600 shrink-0" : "text-slate-500 shrink-0"} />
            <span className="inline truncate">{tab.label}</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold shrink-0 ${isActive ? "bg-blue-50 text-blue-700" : "bg-slate-300/40 text-slate-600"}`}>
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
