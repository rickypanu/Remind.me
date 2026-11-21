import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, ThumbsDown, ThumbsUp } from "../../../components/icons";
import Highlight from "./Highlight";

/** One question: a disclosure button plus its answer panel. */
export default function FaqItem({ faq, isOpen, onToggle, query, showCategory }) {
  const [vote, setVote] = useState(null); // 'up' | 'down' (kept only while the page is open)
  const panelId = `faq-panel-${faq.id}`;
  const buttonId = `faq-button-${faq.id}`;

  return (
    <div className="rs-faq-item" style={{ borderBottom: "1.5px solid var(--rs-line-strong)" }}>
      <h3 style={{ fontSize: "inherit", letterSpacing: "inherit", lineHeight: "inherit" }}>
        <button
          id={buttonId}
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="rs-faq-qbtn"
        >
          <span style={{ minWidth: 0 }}>
            {showCategory && <small className="rs-cat">{faq.category}</small>}
            <span style={{ display: "block", fontFamily: "var(--rs-display)", fontSize: 21, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
              <Highlight text={faq.question} query={query} />
            </span>
          </span>
          <ChevronDown size={22} style={{ flex: "none", transition: "transform .15s ease", transform: isOpen ? "rotate(180deg)" : "none" }} />
        </button>
      </h3>

      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen} className="rs-faq-a">
        <p style={{ color: "var(--rs-ink-2)", maxWidth: "70ch", marginBottom: 16 }}>
          <Highlight text={faq.answer} query={query} />
        </p>
        {faq.steps && (
          <ol>
            {faq.steps.map((step) => (
              <li key={step}>
                <Highlight text={step} query={query} />
              </li>
            ))}
          </ol>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 22 }}>
          {faq.link ? (
            <Link to={faq.link.to} className="rs-link" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {faq.link.label} <ArrowRight size={16} />
            </Link>
          ) : (
            <span />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--rs-ink-3)" }}>
            {vote ? (
              <span role="status">Thanks for your feedback!</span>
            ) : (
              <>
                <span>Was this helpful?</span>
                <button type="button" className="rs-icon-btn" style={{ width: 36, height: 36 }} onClick={() => setVote("up")} aria-label="Yes, this was helpful">
                  <ThumbsUp size={16} />
                </button>
                <button type="button" className="rs-icon-btn" style={{ width: 36, height: 36 }} onClick={() => setVote("down")} aria-label="No, this was not helpful">
                  <ThumbsDown size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
