"use client";

import { useEffect, useState } from "react";
import { validateUsername } from "@/lib/username-rules";

export type UsernameAvailability =
  | { state: "idle" }
  // Fails the format rules - known locally, so no request is made.
  | { state: "invalid"; error: string }
  // Format is fine, the server has not answered yet.
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; error: string };

/**
 * Live availability of a username for the signup form and the settings field.
 * Format errors show immediately; the taken/free lookup is debounced, since
 * the endpoint is rate limited.
 */
export function useUsernameAvailability(
  username: string,
  enabled: boolean,
): UsernameAvailability {
  const [availability, setAvailability] = useState<UsernameAvailability>({
    state: "idle",
  });

  useEffect(() => {
    if (!enabled || !username) {
      setAvailability({ state: "idle" });
      return;
    }

    const validation = validateUsername(username);
    if (!validation.ok) {
      setAvailability({ state: "invalid", error: validation.error });
      return;
    }

    setAvailability({ state: "checking" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/settings/username?username=${encodeURIComponent(username)}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (data.available) {
          setAvailability({ state: "available" });
        } else {
          setAvailability({
            state: "unavailable",
            error: data.error ?? "Not available",
          });
        }
      } catch {
        // An aborted or failed check shouldn't show a red cross - the server
        // validates again on submit either way.
        if (!controller.signal.aborted) {
          setAvailability({ state: "idle" });
        }
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [username, enabled]);

  return availability;
}

/** Whether the availability carries an error to show in red. */
export function usernameError(
  availability: UsernameAvailability,
): string | null {
  if (
    availability.state === "invalid" ||
    availability.state === "unavailable"
  ) {
    return availability.error;
  }
  return null;
}

/**
 * Border and focus-ring colours for a username input: red when it can't be
 * used, light green while a well-formed handle is being checked, full green
 * once the server confirms it is free. `null` means leave the input neutral.
 */
export function usernameStateClass(
  availability: UsernameAvailability,
): string | null {
  switch (availability.state) {
    case "invalid":
    case "unavailable":
      return "border-ctp-red focus:ring-ctp-red/30";
    case "checking":
      return "border-ctp-green/40 focus:ring-ctp-green/20";
    case "available":
      return "border-ctp-green focus:ring-ctp-green/30";
    default:
      return null;
  }
}

/**
 * Text for a screen-reader live region next to the input, so the outcome of
 * the check is announced rather than only shown as a colour and an icon.
 * "Checking" is left silent - it would be read on nearly every keystroke.
 */
export function usernameAnnouncement(
  availability: UsernameAvailability,
): string {
  if (availability.state === "available") {
    return "Username is available";
  }
  return usernameError(availability) ?? "";
}
