"use client";

import { Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import Modal from "./modal";

interface ConfirmDialogProps {
  /** A question naming the action: "Delete theme?". */
  title: string;
  /** The concrete consequence, naming the thing - plus any extra fields. */
  children: React.ReactNode;
  /** The destructive button: "Delete theme". */
  confirmLabel: string;
  /** Shown on it while the request runs: "Deleting…". */
  busyLabel: string;
  /**
   * Runs the action. Resolve with an error message to show it inside the
   * dialog, or with null once done - the caller then closes the dialog (or
   * navigates away) itself. Until it does, the dialog stays busy, so it can't
   * be submitted twice.
   */
  onConfirm: () => Promise<string | null>;
  onCancel: () => void;
  /** Keeps the destructive button disabled, e.g. until a name is typed. */
  confirmDisabled?: boolean;
}

/**
 * The confirmation for every destructive action in settings and the upload
 * wizard. Cancel has the initial focus, and while the request is in flight
 * neither Escape nor a backdrop click can close it - closing would hide
 * whether the delete actually happened.
 */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  onConfirm,
  onCancel,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // State for rendering, the ref for the double-submit guard: two quick
  // clicks both run before the first re-render would disable the button.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (busyRef.current || confirmDisabled) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);

    let problem: string | null;
    try {
      problem = await onConfirm();
    } catch {
      problem = "Something went wrong - please try again.";
    }

    if (problem) {
      busyRef.current = false;
      setBusy(false);
      setError(problem);
    }
  }

  return (
    <Modal
      titleId={titleId}
      role="alertdialog"
      describedById={descriptionId}
      initialFocusRef={cancelRef}
      onRequestClose={() => {
        if (!busyRef.current) {
          onCancel();
        }
      }}
      className="bg-ctp-base rounded-lg border border-ctp-surface0 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          // React events bubble through the portal, so without this the
          // wizard's own <form> around a dialog would see the submit too and
          // move to the next step.
          event.stopPropagation();
          confirm();
        }}
      >
        <h3 id={titleId} className="text-xl font-semibold text-ctp-text mb-3">
          {title}
        </h3>
        <div
          id={descriptionId}
          className="space-y-3 text-sm text-ctp-subtext0 leading-relaxed"
        >
          {children}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-ctp-red">
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 px-4 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-md border-2 border-ctp-surface1 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || confirmDisabled}
            className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-ctp-red text-ctp-crust font-semibold rounded-md border-2 border-ctp-red transition hover:opacity-90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
