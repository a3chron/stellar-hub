"use client";

import { useSyncExternalStore } from "react";
import { formatDate, formatDateTime, formatTimeAgo } from "@/lib/utils";

// Server and client disagree about the time zone (Vercel renders in UTC), so
// a date formatted on both sides is a hydration mismatch waiting to happen.
// These render in UTC on the server and during hydration, then switch to the
// viewer's own clock.

function subscribe() {
  return () => {};
}

function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** "12.10.2026" (or with `withTime`, "12.10.2026, 17:45") in local time. */
export function LocalDate({
  date,
  withTime = false,
}: {
  date: string | Date;
  withTime?: boolean;
}) {
  const hydrated = useHydrated();
  const value = new Date(date);
  const timeZone = hydrated ? undefined : "UTC";
  const text = withTime
    ? formatDateTime(value, timeZone)
    : formatDate(value, timeZone);

  return <time dateTime={value.toISOString()}>{text}</time>;
}

/** "3 min ago", with the exact local date and time on hover. */
export function TimeAgo({ date }: { date: string | Date }) {
  const hydrated = useHydrated();
  const value = new Date(date);

  // The relative text can still differ across a minute boundary between the
  // server render and hydration - harmless, and fixed by the re-render that
  // follows hydration.
  return (
    <time
      dateTime={value.toISOString()}
      title={hydrated ? formatDateTime(value) : undefined}
      suppressHydrationWarning
    >
      {formatTimeAgo(value, new Date(), hydrated ? undefined : "UTC")}
    </time>
  );
}
