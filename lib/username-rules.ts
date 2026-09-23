// Pure username rules with no database access, so client components (the
// signup form, the settings field) can validate as the user types. The
// database-backed helpers live in lib/username.ts, which re-exports these.

export const USERNAME_MAX_LENGTH = 39;

// The username is the public author handle: it is the `/[author]` URL segment
// and the `author` half of the CLI's `stellar apply <author>/<theme>`. The CLI
// parses that identifier with `[a-zA-Z0-9_-]+` (see
// stellar-cli/internal/theme/parser.go), so anything accepted here has to stay
// inside that character set or the theme becomes impossible to apply.
//
// The shape otherwise mirrors GitHub's own rule (start and end alphanumeric,
// max 39), which is what every existing row was backfilled from.
const usernameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{0,37}[a-zA-Z0-9])?$/;

// `/[author]` is a top-level route, so a username matching a real path segment
// would be shadowed by that route and the profile made unreachable. This covers
// what the app routes today plus the obvious candidates for tomorrow.
const RESERVED_USERNAMES = new Set([
  "_next",
  "about",
  "account",
  "admin",
  "api",
  "assets",
  "auth",
  "blog",
  "cli",
  "contact",
  "dashboard",
  "doc",
  "docs",
  "download",
  "downloads",
  "edit",
  "explore",
  "favicon",
  "feed",
  "forgot-password",
  "help",
  "home",
  "hub",
  "index",
  "legal",
  "login",
  "logout",
  "me",
  "new",
  "null",
  "privacy",
  "profile",
  "public",
  "register",
  "robots",
  "reset-password",
  "root",
  "search",
  "settings",
  "signin",
  "sign-in",
  "signout",
  "sign-out",
  "signup",
  "sign-up",
  "sitemap",
  "static",
  "stellar",
  "support",
  "terms",
  "theme",
  "themes",
  "undefined",
  "upload",
  "user",
  "users",
  "verify-email",
  "welcome",
]);

export type UsernameCheck = { ok: true } | { ok: false; error: string };

/**
 * Validates a username against the format and reserved-word rules. Shared by
 * the availability endpoint, the change endpoint and the signup form so the
 * client and the server can never disagree about what is acceptable.
 *
 * Availability is deliberately *not* checked here - that needs the database,
 * see `isUsernameTaken`.
 */
export function validateUsername(raw: string): UsernameCheck {
  const username = raw.trim();

  if (!username) {
    return { ok: false, error: "Username is required" };
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Username must be ${USERNAME_MAX_LENGTH} characters or less`,
    };
  }
  if (!usernameRegex.test(username)) {
    return {
      ok: false,
      error:
        "Username may only contain letters, numbers, hyphens and underscores, and must start and end with a letter or number",
    };
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { ok: false, error: "That username is reserved" };
  }

  return { ok: true };
}

/**
 * Best-effort conversion of an arbitrary provider profile value (a display
 * name, an email local part) into something the username rules accept. Returns
 * an empty string when nothing usable survives, so callers can fall back.
 */
export function slugifyUsername(raw: string): string {
  const slug = raw
    .normalize("NFKD")
    // Strip combining marks, so "Jörg" becomes "Jorg" rather than "J-rg".
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    // Collapse runs introduced by the replace above.
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    // Slicing can leave a trailing separator behind.
    .replace(/[-_]+$/g, "");

  return usernameRegex.test(slug) ? slug : "";
}
