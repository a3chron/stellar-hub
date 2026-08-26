"use client";

import { useEffect } from "react";

/**
 * Asks the browser to confirm before leaving the page while a form holds
 * unsaved input ("Leave site? Changes you made may not be saved").
 *
 * Reloading or navigating away from a half-filled form is easy to do by
 * accident - Ctrl+R, Ctrl+W, a stray back gesture - and on the upload form it
 * costs the user a pasted starship config. Browsers only honour this for
 * pages the user has interacted with, and they always render their own
 * wording, so there is nothing to customise.
 *
 * Pass `false` once the form is submitted successfully, or the confirmation
 * would fire on the navigation that follows a successful save.
 */
export function useUnsavedChangesWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      // preventDefault is the modern signal; returnValue is still required by
      // Chrome and Safari to actually show the dialog.
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);
}
