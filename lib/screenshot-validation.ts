// Shared between the upload wizard (instant feedback on file selection) and
// the screenshot routes (the limit that actually gets enforced), so the two
// can't silently drift apart.
export const ACCEPTED_SCREENSHOT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

// 4 MB rather than 5: Vercel refuses request bodies over 4.5 MB before the
// route ever runs, with a non-JSON 413 - a limit above that could never be
// reached, and the user would get an unexplained proxy error instead.
export const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024; // 4MB

/**
 * Checks a screenshot file against the same type and size rules the server
 * enforces. Returns an error message to show inline, or null when the file
 * is fine.
 */
export function validateScreenshotFile(file: File): string | null {
  if (
    !ACCEPTED_SCREENSHOT_TYPES.includes(
      file.type as (typeof ACCEPTED_SCREENSHOT_TYPES)[number],
    )
  ) {
    return "Screenshot must be a PNG, JPG, or WebP image.";
  }

  if (file.size > MAX_SCREENSHOT_BYTES) {
    return "Screenshot must be less than 4MB.";
  }

  return null;
}
