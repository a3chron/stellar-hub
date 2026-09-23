// Slug generation shared between the upload form (client-side preview and
// live availability check) and anything server-side that needs the same
// limit. Keeping the constant here means the slug column's own cap can't
// drift out of sync with what the form actually lets a slug become.
export const MAX_SLUG_LENGTH = 50;

/**
 * Derives a URL slug from a theme name. Non-latin/non-numeric input (e.g. a
 * name written only in Cyrillic) collapses to an empty string - callers
 * should treat that as "needs a name with some letters or numbers" rather
 * than a valid, if unusual, slug.
 */
/**
 * Cleans a slug the user is typing by hand. Unlike generateSlug it keeps a
 * trailing hyphen, so "my-" can still become "my-theme" - finishSlugInput
 * tidies the ends once they leave the field.
 */
export function sanitizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "")
    .slice(0, MAX_SLUG_LENGTH);
}

export function finishSlugInput(value: string): string {
  return sanitizeSlugInput(value).replace(/-+$/, "");
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-$/, "");
}
