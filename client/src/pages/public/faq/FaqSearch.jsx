import React from "react";
import { Search, X } from "../../../components/icons";

export default function FaqSearch({ value, onChange, onClear }) {
  return (
    <div role="search" style={{ position: "relative" }}>
      <Search size={20} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--rs-ink-3)", pointerEvents: "none" }} />
      <input
        type="search"
        aria-label="Search the FAQs"
        placeholder="Search for answers..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rs-field"
        style={{ paddingLeft: 46, paddingRight: 46 }}
      />
      {value && (
        <button type="button" onClick={onClear} aria-label="Clear search" className="rs-icon-btn" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 38, height: 38, border: 0 }}>
          <X size={18} />
        </button>
      )}
    </div>
  );
}
