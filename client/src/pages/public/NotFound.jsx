import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "../../components/icons";
import SiteLayout from "../../components/site/SiteLayout";
import usePageMeta from "../../utils/usePageMeta";
import { isLoggedIn as hasSession } from "../../utils/auth";

export default function NotFound() {
  const navigate = useNavigate();
  const isLoggedIn = hasSession();
  usePageMeta({
    title: "Page not found (404)",
    description: "The page you are looking for doesn't exist or has moved. Head back to GetRemindMe.",
    noindex: true,
  });

  return (
    <SiteLayout>
      <section className="rs-404">
        <div className="rs-wrap">
          <p className="rs-big" aria-hidden="true">404</p>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", marginTop: 28 }}>This page missed its reminder.</h1>
          <p className="rs-lede" style={{ margin: "16px auto 0", textAlign: "center" }}>
            We couldn&apos;t find the page you were looking for. It may have moved, or the link might be mistyped.
          </p>
          <div className="rs-cta-row" style={{ justifyContent: "center" }}>
            <Link to={isLoggedIn ? "/dashboard" : "/"} className="rs-btn rs-btn--gold">
              <Home size={18} /> {isLoggedIn ? "Go to dashboard" : "Back to home"}
            </Link>
            <button type="button" className="rs-btn rs-btn--line" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
              <ArrowLeft size={18} /> Go back
            </button>
          </div>
          <p style={{ marginTop: 28 }}>
            <Link to="/faqs" className="rs-link">Visit the help centre</Link>
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
