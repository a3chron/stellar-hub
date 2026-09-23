"use client";

import { useState } from "react";

/**
 * Gates a modal's close (Cancel button, Escape, backdrop click) behind an
 * inline confirmation when discarding right now would lose a substantial
 * edit. Trivial edits - a metadata text tweak - should never be nagged, so
 * callers only pass `true` for `isDirty` when the loss would actually hurt:
 * a rewritten config, a newly chosen screenshot.
 */
export function useConfirmClose(isDirty: boolean, onClose: () => void) {
  const [confirming, setConfirming] = useState(false);

  function requestClose() {
    if (isDirty) {
      setConfirming(true);
      return;
    }
    onClose();
  }

  function confirmDiscard() {
    setConfirming(false);
    onClose();
  }

  function cancelDiscard() {
    setConfirming(false);
  }

  return { confirming, requestClose, confirmDiscard, cancelDiscard };
}
