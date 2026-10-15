import React from "react";
import { Toaster } from "react-hot-toast";

/** Mounted ONCE in App.jsx. All messages come from utils/notify.js. */
export default function AppToaster() {
  return (
    <div aria-live="polite" role="status">
      <Toaster
        position="top-center"
        gutter={10}
        containerStyle={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 12, right: 12 }}
        toastOptions={{ className: "rm-toast" }}
      />
    </div>
  );
}
