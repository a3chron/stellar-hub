import { db } from "@/lib/db";

/**
 * Whether the given author already has a theme with this slug. Backs both
 * the live availability check on the upload form
 * (/api/upload/check) and the duplicate check /api/upload falls back to at
 * submit time - the unique index on (authorId, slug) is what actually
 * enforces this under a race between the two.
 */
export async function themeSlugTaken(
  authorId: string,
  slug: string,
): Promise<boolean> {
  const existing = await db.query.themes.findFirst({
    where: (themes, { and, eq }) =>
      and(eq(themes.authorId, authorId), eq(themes.slug, slug)),
  });

  return !!existing;
}
