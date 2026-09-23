import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import {
  slugifyUsername,
  USERNAME_MAX_LENGTH,
  validateUsername,
} from "@/lib/username-rules";

export {
  slugifyUsername,
  USERNAME_MAX_LENGTH,
  type UsernameCheck,
  validateUsername,
} from "@/lib/username-rules";

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
