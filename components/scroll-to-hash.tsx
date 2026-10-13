"use client";

import { useEffect } from "react";

/**
 * Scrolls to the element the URL hash names (`/settings#cli-logins`) once the
 * page content is actually there. Pages with a loading.tsx stream their
 * content in after the browser has already looked for the anchor and found
 * only the skeleton, so the native jump never happens on them.
 */
export default function ScrollToHash() {
  useEffect(() => {
    let id = "";
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (id) {
      document.getElementById(id)?.scrollIntoView();
    }
  }, []);

  return null;
}
