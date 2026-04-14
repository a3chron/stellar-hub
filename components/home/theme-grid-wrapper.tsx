import { and, desc, eq, or, type SQL, sql } from "drizzle-orm";
import Pagination from "@/components/pagination";
import ThemeCard from "@/components/theme-card";
import { db } from "@/lib/db";
import type { colorModeEnum } from "@/lib/db/schema";
import { themes } from "@/lib/db/schema";

interface ThemeGridWrapperProps {
  sort: string;
  colorSchemeId?: string;
  colorMode?: (typeof colorModeEnum.enumValues)[number];
  page: number;
}

export async function ThemeGridWrapper({
  sort,
  colorSchemeId,
  colorMode,
  page,
}: ThemeGridWrapperProps) {
  const limit = 12;
  const offset = (page - 1) * limit;

  // Build where clause for filters
  const whereConditions = [];
  if (colorSchemeId) {
    whereConditions.push(eq(themes.colorSchemeId, colorSchemeId));
  }
  if (colorMode === "dark") {
    whereConditions.push(
      or(eq(themes.colorMode, "dark"), eq(themes.colorMode, "both"))!,
    );
  } else if (colorMode === "light") {
    whereConditions.push(
      or(eq(themes.colorMode, "light"), eq(themes.colorMode, "both"))!,
    );
  } else if (colorMode === "both") {
    whereConditions.push(eq(themes.colorMode, "both"));
  }

  // Determine order by based on sort parameter
  let orderBy: SQL[];
  if (sort === "latest") {
    orderBy = [desc(themes.createdAt)];
  } else if (sort === "trending") {
    // Time-decay score: downloads / (age_in_hours + 2)^1.5
    orderBy = [
      desc(
        sql`${themes.downloads} / POWER(EXTRACT(EPOCH FROM (NOW() - ${themes.createdAt})) / 3600 + 2, 1.5)`,
      ),
      desc(themes.createdAt),
    ];
  } else {
    // Default: most downloads
    orderBy = [desc(themes.downloads)];
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // Get total count for pagination
  const totalCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(themes)
    .where(whereClause);
  const totalCount = Number(totalCountResult[0]?.count || 0);
  const totalPages = Math.ceil(totalCount / limit);

  const displayedThemes = await db.query.themes.findMany({
    where: whereClause,
    orderBy,
    limit,
    offset,
    with: {
      author: true,
      colorScheme: true,
    },
  });

  if (displayedThemes.length === 0) {
    return (
      <div className="text-center py-12 text-ctp-subtext0">
        <p>No themes found with the selected filters.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {displayedThemes.map((theme, index) => (
          <ThemeCard key={theme.id} theme={theme} priority={index < 6} />
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} />
    </>
  );
}
