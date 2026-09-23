// Shared between the upload form (instant feedback on file selection) and
// /api/upload (the limit that actually gets enforced), so the two can't
// silently drift apart.
export const ACCEPTED_SCREENSHOT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5MB

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
    return "Screenshot must be less than 5MB.";
  }

  return null;
}
