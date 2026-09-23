"use client";

import { useEffect, useState } from "react";

export type ThemeSlugAvailability =
  | { state: "idle" }
  // The name doesn't produce any latin letters or digits (e.g. "Ночь"), so
  // there is no slug to check yet - known locally, no request is made.
  | { state: "empty" }
  // A usable slug exists, the server has not answered yet.
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable" };

/**
 * Live availability of the auto-generated theme slug for the signed-in
 * user, mirroring useUsernameAvailability: an unusable slug shows up
 * instantly, the taken/free lookup against the user's own themes is
 * debounced since it hits the database.
 */
export function useThemeSlugAvailability(
  name: string,
  slug: string,
  enabled: boolean,
): ThemeSlugAvailability {
  const [availability, setAvailability] = useState<ThemeSlugAvailability>({
    state: "idle",
  });

  // Derived rather than depended on directly: several distinct names can
  // produce the same slug (punctuation, casing, ...), and depending on `name`
  // itself re-fired the debounced check - and flashed "checking" - on every
  // one of those keystrokes even though the thing actually being checked
  // hadn't changed.
  const nameIsEmpty = !name.trim();

  useEffect(() => {
    if (!enabled || nameIsEmpty) {
      setAvailability({ state: "idle" });
      return;
    }

    if (!slug) {
      setAvailability({ state: "empty" });
      return;
    }

    setAvailability({ state: "checking" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/upload/check?slug=${encodeURIComponent(slug)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          // A 401/500 here isn't "this slug is taken" - treat it the same as
          // an aborted/failed request and let the server be the final say on
          // submit, rather than disabling the form over an unrelated error.
          if (!controller.signal.aborted) {
            setAvailability({ state: "idle" });
          }
          return;
        }
        const data = await response.json();
        setAvailability(
          data.available ? { state: "available" } : { state: "unavailable" },
        );
      } catch {
        // An aborted or failed check shouldn't show a red cross - the server
        // checks again on submit either way.
        if (!controller.signal.aborted) {
          setAvailability({ state: "idle" });
        }
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [nameIsEmpty, slug, enabled]);

  return availability;
}

/** Whether the availability carries an error to show in red. */
export function themeSlugError(
  availability: ThemeSlugAvailability,
): string | null {
  if (availability.state === "empty") {
    return "This name needs at least one letter or number (a-z, 0-9) so a URL slug can be generated.";
  }
  if (availability.state === "unavailable") {
    return "You already have a theme with this slug.";
  }
  return null;
}

/**
 * Border and focus-ring colours for the slug field, matching the username
 * field's visual language: red when it can't be used, light green while a
 * usable slug is being checked, full green once the server confirms it is
 * free. `null` means leave the input neutral.
 */
export function themeSlugStateClass(
  availability: ThemeSlugAvailability,
): string | null {
  switch (availability.state) {
    case "empty":
    case "unavailable":
      return "border-ctp-red! focus:ring-ctp-red/30!";
    case "checking":
      return "border-ctp-green/40! focus:ring-ctp-green/20!";
    case "available":
      return "border-ctp-green! focus:ring-ctp-green/30!";
    default:
      return null;
  }
}

/**
 * Text for a screen-reader live region next to the slug field. "Checking" is
 * left silent - it would be read on nearly every keystroke.
 */
export function themeSlugAnnouncement(
  availability: ThemeSlugAvailability,
): string {
  if (availability.state === "available") {
    return "This slug is available";
  }
  return themeSlugError(availability) ?? "";
}
