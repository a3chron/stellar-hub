import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

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

/** Case-insensitive existence check, matching the unique index on lower(username). */
export async function isUsernameTaken(
  username: string,
  excludeUserId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.username}) = lower(${username})`)
    .limit(2);

  return rows.some((row) => row.id !== excludeUserId);
}

/**
 * Derives a free, valid username from whatever the provider gave us.
 *
 * Every social provider hands over something different - GitHub and GitLab
 * give a real handle, Google only a display name and an email - so candidates
 * are tried in order of how handle-like they are, then disambiguated with a
 * numeric suffix. The result is guaranteed valid and free at the time of the
 * call; the unique index is what actually settles a race.
 */
export async function generateUniqueUsername(
  candidates: (string | null | undefined)[],
): Promise<string> {
  const seeds = candidates
    .map((candidate) => (candidate ? slugifyUsername(candidate) : ""))
    .filter((candidate) => candidate && validateUsername(candidate).ok);

  // Nothing usable in the profile (e.g. an email that is entirely non-ASCII):
  // fall back to a generic stem that the suffix loop below will make unique.
  const base = seeds[0] ?? "user";

  for (const seed of seeds) {
    if (!(await isUsernameTaken(seed))) {
      return seed;
    }
  }

  for (let suffix = 2; suffix < 100; suffix++) {
    // Keep room for the suffix rather than overflowing the length limit.
    const stem = base.slice(0, USERNAME_MAX_LENGTH - String(suffix).length - 1);
    const candidate = `${stem.replace(/[-_]+$/g, "")}-${suffix}`;
    if (validateUsername(candidate).ok && !(await isUsernameTaken(candidate))) {
      return candidate;
    }
  }

  // Astronomically unlikely to be reached; a random tail keeps user creation
  // working rather than failing the sign-in.
  return `${base.slice(0, 30).replace(/[-_]+$/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Case-insensitive match against a username column, mirroring the
 * `lower(username)` unique index. Profile and theme URLs are shared by hand and
 * typed from memory, so `/A3chron/ctp-blue` has to find `a3chron` rather than
 * 404 - and using the same expression as the index keeps the lookup on it.
 */
export function usernameEquals(column: AnyPgColumn, value: string): SQL {
  return sql`lower(${column}) = lower(${value})`;
}
