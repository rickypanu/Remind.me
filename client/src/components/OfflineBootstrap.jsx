import { useEffect } from "react";
import { startSyncEngine, flushPending } from "../offline/sync";
import { installAudioUnlock } from "../feedback/sounds";
import { feedback } from "../feedback/feedback";

/**
 * Renders nothing. Mounted once in App.jsx to:
 *  - start the sync engine (online / offline / visibility listeners, retries)
 *  - listen to messages from the service worker:
 *      REMINDME_SYNC -> the browser's Background Sync fired: upload now
 *      PLAY_ALERT    -> a push arrived while the app is open: play the chosen notification sound
 *  - unlock Web Audio on the first tap (browser autoplay rules)
 */
export default function OfflineBootstrap() {
  useEffect(() => {
    installAudioUnlock();
    const stop = startSyncEngine();

    const onMessage = (event) => {
      if (event.data?.type === "REMINDME_SYNC") flushPending();
      if (event.data?.type === "PLAY_ALERT") feedback.notification();
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    return () => {
      stop();
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
