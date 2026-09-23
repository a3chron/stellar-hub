import { getTableName, type SQL, sql } from "drizzle-orm";
import { themes, user } from "@/lib/db/schema";

/**
 * Anything longer than this couldn't possibly match a name/slug/handle and
 * would just be wasted work building the ILIKE patterns. Shared by the quick
 * search API route and the gallery's own `?q=` handling so both cap input at
 * the same length.
 */
export const MAX_SEARCH_QUERY_LENGTH = 100;

/**
 * Escapes the wildcards ILIKE would otherwise interpret, so a search for
 * "100%" or "a_c" matches those characters literally instead of everything.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Builds an ILIKE condition matching a theme's name, slug or description, or
 * its author's display name / handle.
 *
 * The author half needs a subquery rather than an interpolated join: the
 * relational query builder (`db.query.themes.findMany`) rewrites every
 * Column chunk in `where` to the root table's alias, so a bare
 * `user.username` here would come out as `"themes"."username"`, which
 * doesn't exist. See the same trick (and the same warning) around the
 * `authorName` filter in app/api/themes/route.ts.
 */
export function buildThemeSearchCondition(query: string): SQL {
  const term = `%${escapeLike(query)}%`;
  const userTable = sql.identifier(getTableName(user));

  return sql`(
    ${themes.name} ILIKE ${term}
    OR ${themes.slug} ILIKE ${term}
    OR ${themes.description} ILIKE ${term}
    OR ${themes.authorId} IN (
      SELECT ${userTable}.${sql.identifier(user.id.name)}
      FROM ${userTable}
      WHERE ${userTable}.${sql.identifier(user.name.name)} ILIKE ${term}
         OR ${userTable}.${sql.identifier(user.username.name)} ILIKE ${term}
    )
  )`;
}

/**
 * EXISTS condition restricting a `db.query.user.findMany` result to users who
 * have published at least one theme. Without it, the quick-search author
 * results double as a yes/no oracle over the whole user table - every
 * name/handle match comes back regardless of whether that account has ever
 * published anything.
 *
 * `user` is the root table for that query, so `user.id` doesn't need the
 * rewrite guard below - but `themes.authorId` belongs to a different table,
 * so it goes through `sql.identifier` for the same reason the reverse lookup
 * above does (see that function's docblock).
 */
export function authorHasThemeCondition(): SQL {
  const themesTable = sql.identifier(getTableName(themes));

  return sql`EXISTS (
    SELECT 1 FROM ${themesTable}
    WHERE ${themesTable}.${sql.identifier(themes.authorId.name)} = ${user.id}
  )`;
}
