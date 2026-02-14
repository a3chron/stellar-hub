/**
 * File validation utilities to prevent path traversal attacks
 * when deleting files from Supabase storage.
 */

/**
 * Validates that a screenshot filename matches the expected format: {userId}-{timestamp}.webp
 * This prevents path traversal attacks when deleting files.
 *
 * @param filename - The filename to validate
 * @returns true if the filename matches the expected pattern
 */
export function isValidScreenshotFilename(filename: string): boolean {
  // Pattern: userId (alphanumeric/underscore/hyphen) - timestamp (13 digits) .webp
  // Example: cuid12345678-1709234567890.webp
  const pattern = /^[a-zA-Z0-9_-]+-\d{13}\.webp$/;
  return pattern.test(filename);
}

/**
 * Validates that an avatar filename matches the expected format: {userId}-{timestamp}.webp
 * Note: Avatar files are stored in the "avatars/" subdirectory
 *
 * @param filename - The filename to validate (without the avatars/ prefix)
 * @returns true if the filename matches the expected pattern
 */
export function isValidAvatarFilename(filename: string): boolean {
  // Same pattern as screenshots since they share the format
  const pattern = /^[a-zA-Z0-9_-]+-\d{13}\.webp$/;
  return pattern.test(filename);
}

/**
 * Safely extracts and validates a filename from a Supabase storage URL
 * Returns null if the filename is invalid or potentially malicious
 *
 * @param url - The full URL to the file
 * @param validator - A function to validate the extracted filename
 * @returns The validated filename, or null if invalid
 */
export function extractValidFilename(
  url: string,
  validator: (filename: string) => boolean,
): string | null {
  const filename = url.split("/").pop();
  if (!filename || !validator(filename)) {
    return null;
  }
  return filename;
}
