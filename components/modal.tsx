"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  /** id of the element (usually the heading) that labels this dialog. */
  titleId: string;
  /**
   * Called when the user tries to dismiss the dialog via Escape or a
   * backdrop click. Never closes the dialog itself - a caller that needs to
   * confirm a discard first can intercept the call and decide what to show
   * instead of unmounting immediately.
   */
  onRequestClose: () => void;
  children: React.ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Minimal accessible dialog chrome shared by the settings modals: moves
 * focus into the dialog on open and restores it to whatever triggered the
 * dialog on close, traps Tab inside it, locks background scroll, and treats
 * Escape/backdrop clicks as a close *request* rather than closing outright.
 */
export default function Modal({
  titleId,
  onRequestClose,
  children,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Kept current via a ref instead of an effect dependency so the
  // mount/unmount effect below runs exactly once, regardless of how often
  // the caller's onRequestClose identity changes across renders (it isn't
  // memoized by every caller). Depending on it directly would re-run the
  // effect - and re-steal focus - on every keystroke in the form.
  const onRequestCloseRef = useRef(onRequestClose);
  useEffect(() => {
    onRequestCloseRef.current = onRequestClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable ?? dialog)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onRequestCloseRef.current();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      // Focus can end up outside the dialog entirely - not just past its
      // first/last focusable - e.g. when the previously focused element was
      // hidden or removed (a confirm view swapping in) and the browser fell
      // back to <body>. Reclaiming it here rather than only reacting to
      // first/last means Tab can never actually escape the dialog.
      if (!dialogRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onRequestCloseRef.current();
    }
  }

  // Portalled to <body> so the fixed backdrop always spans the viewport:
  // rendered in place it sits inside the page tree, where any ancestor that
  // creates a containing block or stacking context can clip it or draw over
  // it (it left an undimmed strip along the bottom of the settings page).
  return createPortal(
    // The backdrop itself carries the dialog role (mirroring
    // config-preview-modal.tsx) so the click-to-dismiss handler below sits on
    // an element that is already interactive rather than a bare <div>. Its
    // onClick only dismisses on a backdrop *click* - Escape is already
    // handled for keyboard users by the document-level listener in the
    // effect above, so a second key handler here would fire onRequestClose
    // twice per Escape.
    // biome-ignore lint/a11y/useKeyWithClickEvents: see comment above.
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] outline-none"
      onClick={handleBackdropClick}
    >
      <div
        className={
          className ??
          "bg-ctp-base rounded-lg border border-ctp-surface0 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        }
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
