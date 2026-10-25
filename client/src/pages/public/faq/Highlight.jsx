import React from "react";

/** Wraps the searched words inside a piece of text in <mark>. Plain text in, no HTML ever injected. */
export default function Highlight({ text, query }) {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={index} className="bg-indigo-100 text-indigo-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
