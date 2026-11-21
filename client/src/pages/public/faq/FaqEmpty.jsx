import React from "react";

export default function FaqEmpty({ query, onReset }) {
  return (
    <div className="rs-empty">
      <h3 style={{ fontSize: 24, marginBottom: 8 }}>No results found</h3>
      <p style={{ maxWidth: "40ch", margin: "0 auto 18px" }}>
        We couldn&apos;t find any FAQs matching &ldquo;{query}&rdquo;. Try different words or another category.
      </p>
      <button type="button" onClick={onReset} className="rs-btn rs-btn--line rs-btn--small">
        Reset search
      </button>
    </div>
  );
}
