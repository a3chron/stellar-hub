import { and, asc, count, desc, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";

/** One of an author's theme groups and how many themes are in it. */
export interface ThemeGroup {
  name: string;
  count: number;
}

/**
 * The groups the author already uses on published themes, most used first,
 * for the group picker. Groups are matched by exact string, so offering the
 * existing spelling is what keeps "Catppuccin" and "catppuccin" from ending
 * up as two groups.
 */
export async function getAuthorGroups(authorId: string): Promise<ThemeGroup[]> {
  const rows = await db
    .select({ name: themes.group, count: count() })
    .from(themes)
    .where(
      and(
        eq(themes.authorId, authorId),
        isNotNull(themes.group),
        ne(themes.group, ""),
      ),
    )
    .groupBy(themes.group)
    .orderBy(desc(count()), asc(themes.group));

  return rows.flatMap((row) =>
    row.name ? [{ name: row.name, count: row.count }] : [],
  );
}
