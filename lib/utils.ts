export function cn(...inputs: (string | undefined | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}

// Intl deals with the awkward cases so we don't have to: 1049 rounds down to
// "1K" rather than showing a misleading "1.1K", and 999950 promotes to "1M"
// instead of "1000K".
const compactNumberFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Formats a count so it stays readable once it grows: 2345 -> "2.3k",
 * 1234567 -> "1.2M". Values under 1000 are returned unchanged.
 *
 * Pair it with the exact number in a `title` where precision still matters -
 * a theme author looking at their own download count, for instance.
 */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  // Intl emits an uppercase "K"; lowercase is the usual convention for
  // thousands and reads better beside the uppercase M/B.
  return compactNumberFormat.format(value).replace("K", "k");
}

/** "1 download", "2.3k downloads". */
export function formatDownloads(value: number): string {
  const suffix = value === 1 ? "download" : "downloads";
  return `${formatCompactNumber(value)} ${suffix}`;
}

// Dates are always shown the European way - 12.10.2026, 17:45 - regardless of
// the browser's locale, which would turn them into 10/12/2026, 5:45 PM in an
// English browser. de-DE is used for the pattern only; the words around the
// dates stay English.
function dateFormat(timeZone?: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  });
}

function dateTimeFormat(timeZone?: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
}

/** "12.10.2026". */
export function formatDate(date: Date, timeZone?: string): string {
  return dateFormat(timeZone).format(date);
}

/** "12.10.2026, 17:45". */
export function formatDateTime(date: Date, timeZone?: string): string {
  return dateTimeFormat(timeZone).format(date);
}

/** "just now", "3 min ago", "5 h ago", "2 days ago", then the date. */
export function formatTimeAgo(
  date: Date,
  now: Date = new Date(),
  timeZone?: string,
): string {
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  return formatDate(date, timeZone);
}
