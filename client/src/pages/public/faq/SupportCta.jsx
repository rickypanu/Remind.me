import React from "react";
import { Mail } from "../../../components/icons";
import { mailto } from "../../../config/site";

const SUPPORT_MAILTO = mailto("Support Request - GetRemindMe");

export default function SupportCta() {
  return (
    <div className="rs-card" style={{ marginTop: 48, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20, background: "var(--rs-gold-soft)" }}>
      <div>
        <h2 style={{ fontSize: 26 }}>Still have questions?</h2>
        <p style={{ marginTop: 6 }}>Can&apos;t find the answer you&apos;re looking for? Write to us and we&apos;ll get back to you.</p>
      </div>
      <a href={SUPPORT_MAILTO} className="rs-btn rs-btn--gold">
        <Mail size={18} /> Contact support
      </a>
    </div>
  );
}
