import React, { useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import Modal from "./Modal";

/** "Delete reminder?" modal shared by the task card and the tablet detail panel. */
export default function ConfirmDeleteDialog({ task, isRecurring, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(null);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      role="alertdialog"
      onClose={onCancel}
      busy={busy}
      labelledBy="delete-title"
      describedBy="delete-desc"
      initialFocusRef={cancelRef}
    >
      <div className="rm-modal-in bg-white rounded-[28px] shadow-2xl w-full max-w-sm p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-red-600" size={26} strokeWidth={2.5} />
        </div>
        <h3 id="delete-title" className="text-xl font-bold text-slate-900 mb-2">Delete reminder?</h3>
        <p id="delete-desc" className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
          "<span className="font-semibold text-slate-700 break-words">{task.title}</span>" will be deleted
          permanently{isRecurring ? ", and all of its future reminders will stop" : ""}.
        </p>
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
          >
            {busy && <Loader2 className="animate-spin" size={16} strokeWidth={3} />}
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
