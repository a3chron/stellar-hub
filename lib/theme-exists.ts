import { db } from "@/lib/db";

/**
 * Whether the given author already has a theme with this slug. Backs the
 * live availability check in the upload wizard (/api/upload/check) and the
 * duplicate checks of the drafts API and publishing - the unique index on
 * (authorId, slug) is what actually enforces this under a race.
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
