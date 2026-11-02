import React, { useState } from "react";
import { Download, Share, X } from "lucide-react";
import useInstall, { dismissInstallBanner, installBannerDismissed, promptInstall } from "../utils/install";
import InstallSheet from "./InstallSheet";
import notify from "../utils/notify";

/**
 * Dashboard card: "Install RemindMe". Android / desktop Chrome get the real install dialog in one tap; iPhone gets
 * the Add-to-Home-Screen steps. Hidden once installed, and for two weeks after "Not now".
 */
export default function InstallBanner() {
  const install = useInstall();
  const [dismissed, setDismissed] = useState(installBannerDismissed);
  const [sheet, setSheet] = useState(false);

  if (dismissed || install.standalone || !(install.canPrompt || install.ios)) return null;

  const onInstall = async () => {
    if (install.canPrompt) {
      const ok = await promptInstall();
      if (ok) notify.success("Installing RemindMe…");
    } else {
      setSheet(true);
    }
  };

  return (
    <>
      <section
        aria-label="Install RemindMe"
        className="rm-ios-card rm-card-in mb-4 flex items-center gap-3 rounded-[22px] border border-blue-200 bg-blue-50 p-3.5 pr-2.5"
      >
        <img src="/icon-192x192.png" alt="" width="44" height="44" className="h-11 w-11 shrink-0 rounded-[12px] shadow-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold leading-tight text-slate-900">Add RemindMe to your Home Screen</p>
          <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-slate-700">Opens in one tap and works offline.</p>
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2.5 text-[13.5px] font-bold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-95"
        >
          {install.canPrompt ? <Download size={16} strokeWidth={2.6} aria-hidden="true" /> : <Share size={16} strokeWidth={2.6} aria-hidden="true" />}
          {install.canPrompt ? "Install" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            dismissInstallBanner();
            setDismissed(true);
          }}
          aria-label="Hide for now"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X size={17} strokeWidth={2.5} />
        </button>
      </section>
      {sheet && <InstallSheet iosSafari={install.iosSafari} onClose={() => setSheet(false)} />}
    </>
  );
}
