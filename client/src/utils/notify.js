import toast from "react-hot-toast";

/**
 * One place for every success / error / info message in the app, so they all look and behave the same.
 * Styling lives in theme.css (.rm-toast) so it follows light / dark / minimal themes automatically.
 *
 *   notify.success("Reminder created");
 *   notify.error(err, "Couldn't create reminder");   // pulls the server's message out of an Axios error
 */
import { getErrorMessage } from "./errors";

const base = { className: "rm-toast", position: "top-center" };

export const notify = {
  success: (message, opts = {}) => toast.success(message, { ...base, duration: 3000, ...opts }),
  info: (message, opts = {}) => toast(message, { ...base, duration: 3500, icon: "ℹ️", ...opts }),
  // Accepts a string OR an error object. Errors stay on screen a little longer so they can be read.
  error: (errOrMessage, fallback = "Something went wrong. Please try again.", opts = {}) => {
    const message = typeof errOrMessage === "string" ? errOrMessage : getErrorMessage(errOrMessage, fallback);
    return toast.error(message, { ...base, duration: 5000, ...opts });
  },
  dismiss: (id) => toast.dismiss(id),
};

export default notify;
