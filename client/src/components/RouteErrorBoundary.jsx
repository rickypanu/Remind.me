import React from "react";

/** Catches a page that failed to load (for example offline with an uncached chunk) and offers a retry. */
export default class RouteErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Route failed to render:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">This page could not be loaded</h1>
        <p className="max-w-sm text-sm text-slate-600">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        >
          Reload
        </button>
      </div>
    );
  }
}
