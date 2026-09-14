import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function MenuItems({
  icon: Icon,
  label,
  onClick,
  to,
  rightElement,
  danger,
  disabled,
  subLabel,
  badge, // Added badge prop
}) {
  const content = (
    <div
      className={`flex items-center justify-between p-4 w-full text-left transition-colors ${
        disabled ? "opacity-60 bg-gray-50" : "bg-white hover:bg-gray-50 active:bg-gray-100"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`p-2.5 rounded-xl ${
            danger ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"
          }`}
        >
          <Icon size={20} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${danger ? "text-red-600" : "text-gray-900"}`}>
              {label}
            </span>
            {/* The Badge UI */}
            {badge > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
                {badge}
              </span>
            )}
          </div>
          {subLabel && <span className="text-xs text-gray-500 mt-0.5">{subLabel}</span>}
        </div>
      </div>
      {rightElement || (!onClick && !disabled && <ChevronRight size={18} className="text-gray-400" />)}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block border-b border-gray-100 last:border-0">
        {content}
      </Link>
    );
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="block w-full border-b border-gray-100 last:border-0"
    >
      {content}
    </button>
  );
}