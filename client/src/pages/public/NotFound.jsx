import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass, Home, ArrowLeft, HelpCircle } from "lucide-react";
import PublicLayout from "../../components/PublicLayout";
import usePageMeta from "../../utils/usePageMeta";

export default function NotFound() {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem("token");
  usePageMeta({
    title: "Page not found (404)",
    description: "The page you are looking for doesn't exist or has moved. Head back to RemindMe.",
    noindex: true,
  });

  return (
    <PublicLayout>
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 shadow-sm">
          <Compass size={38} strokeWidth={2} />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest text-blue-600">Error 404</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Page not found</h1>
        <p className="mt-4 max-w-md leading-relaxed text-slate-600">
          We couldn&apos;t find the page you were looking for. It may have been moved, or the link might be mistyped.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            to={isLoggedIn ? "/dashboard" : "/"}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <Home size={18} /> {isLoggedIn ? "Go to dashboard" : "Back to home"}
          </Link>
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <ArrowLeft size={18} /> Go back
          </button>
        </div>

        <Link to="/faqs" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700">
          <HelpCircle size={16} /> Visit the help centre
        </Link>
      </section>
    </PublicLayout>
  );
}
