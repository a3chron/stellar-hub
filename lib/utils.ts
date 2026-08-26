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
