import React from "react";
import { Mail } from "lucide-react";
import { mailto } from "../../../config/site";

const SUPPORT_MAILTO = mailto("Support Request - RemindMe");

export default function SupportCta() {
  return (
    <div className="mt-12 bg-indigo-50 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 border border-indigo-100">
      <div>
        <h2 className="text-indigo-900 font-bold text-lg mb-1">Still have questions?</h2>
        <p className="text-indigo-800 text-sm font-medium">
          Can&apos;t find the answer you&apos;re looking for? Reach out and we&apos;ll get back to you.
        </p>
      </div>
      <a
        href={SUPPORT_MAILTO}
        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto justify-center shrink-0"
      >
        <Mail className="w-4 h-4" aria-hidden="true" />
        Contact Support
      </a>
    </div>
  );
}
