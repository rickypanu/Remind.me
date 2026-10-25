import React, { useEffect, useRef } from "react";

/**
 * Accessible modal built on the native <dialog> element (finding X5).
 *
 * `showModal()` gives, with no custom code: a real focus trap, an inert page behind the dialog (so screen
 * readers cannot wander into it), Escape to close and a top layer above every z-index.
 * This wrapper adds what the browser does not:
 *   - focus goes to `initialFocusRef` (or the first control) when it opens and back to the opener when it closes,
 *   - `busy` blocks every way of closing (Escape, backdrop, the Close event) while a request is running,
 *   - a click on the backdrop closes it.
 *
 * Mount it only while it should be visible: `{target && <Modal ...>}`. `labelledBy` is required: it names
 * the dialog for assistive technology. The single child is the visible panel (the <dialog> itself is a transparent
 * full-screen flex container that centres it).
 */
export default function Modal({
  onClose,
  labelledBy,
  describedBy,
  busy = false,
  align = "center", // "center" | "sheet" (bottom sheet on phones, centred from 640px)
  initialFocusRef,
  role, // "alertdialog" for destructive confirmations
  children,
}) {
  const dialogRef = useRef(null);
  const latest = useRef({ onClose, busy });
  useEffect(() => {
    latest.current = { onClose, busy };
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const opener = document.activeElement;

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", ""); // very old browsers: still visible, just without the native extras
    }
    initialFocusRef?.current?.focus();

    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
    // Runs once per mount: the dialog is mounted exactly while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestClose = () => {
    if (!latest.current.busy) latest.current.onClose?.();
  };

  return (
    <dialog
      ref={dialogRef}
      className="rm-dialog"
      data-align={align}
      role={role}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(event) => {
        // Escape: React owns the open/closed state, so cancel the browser's own close and ask the owner.
        event.preventDefault();
        requestClose();
      }}
      onClose={(event) => {
        // The browser closed it anyway (some browsers allow a second Escape). Keep React and the DOM in step.
        if (latest.current.busy) event.currentTarget.showModal?.();
        else latest.current.onClose?.();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      {children}
    </dialog>
  );
}
