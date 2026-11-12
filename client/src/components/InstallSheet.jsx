import React, { useRef } from "react";
import { Share, SquarePlus, CheckCircle2, X, Compass } from "lucide-react";
import Modal from "./Modal";

/**
 * Step-by-step "Add to Home Screen" help for iPhone / iPad, where the browser has no install button.
 * Opens as a bottom sheet on phones.
 */
export default function InstallSheet({ onClose, iosSafari = true }) {
  const doneRef = useRef(null);
  const steps = iosSafari
    ? [
        { Icon: Share, title: "Tap the Share button", body: "It is the square with an arrow at the bottom of Safari (top right on iPad)." },
        { Icon: SquarePlus, title: "Choose “Add to Home Screen”", body: "Scroll down in the share menu if you do not see it." },
        { Icon: CheckCircle2, title: "Tap Add", body: "Deadline now sits on your home screen and opens full screen, like a normal app." },
      ]
    : [
        { Icon: Compass, title: "Open this page in Safari", body: "iPhone only allows Add to Home Screen from Safari. Copy the address, open Safari and paste it." },
        { Icon: Share, title: "Tap Share, then “Add to Home Screen”", body: "Then tap Add. The app opens full screen from your home screen." },
      ];

  return (
    <Modal onClose={onClose} labelledBy="install-title" align="sheet" initialFocusRef={doneRef}>
      <div className="rm-modal-in w-full max-w-md rounded-t-[28px] border border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icon-192x192.png" alt="" width="48" height="48" className="h-12 w-12 shrink-0 rounded-[14px] shadow-sm" />
            <div className="min-w-0">
              <h2 id="install-title" className="text-lg font-extrabold leading-tight text-slate-900">
                Add Deadline to your Home Screen
              </h2>
              <p className="mt-0.5 text-[13px] font-medium text-slate-600">Opens instantly, works offline, no App Store.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <ol className="space-y-3">
          {steps.map(({ Icon, title, body }, i) => (
            <li key={title} className="flex gap-3.5 rounded-2xl bg-slate-50 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold leading-snug text-slate-900">
                  <span className="mr-1.5 text-blue-700">{i + 1}.</span>
                  {title}
                </p>
                <p className="mt-0.5 text-[13px] font-medium leading-relaxed text-slate-600">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          ref={doneRef}
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-blue-600 py-3.5 text-[15px] font-bold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.99]"
        >
          Got it
        </button>
      </div>
    </Modal>
  );
}
