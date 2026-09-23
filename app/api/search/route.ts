import { and, asc, desc, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { themes, user } from "@/lib/db/schema";
import { getClientIP, searchRateLimiter } from "@/lib/rate-limit";
import {
  authorHasThemeCondition,
  buildThemeSearchCondition,
  escapeLike,
  MAX_SEARCH_QUERY_LENGTH,
} from "@/lib/theme-search";

const THEME_RESULT_LIMIT = 6;
const AUTHOR_RESULT_LIMIT = 4;

/**
 * Lightweight "quick search" endpoint backing the nav's Ctrl+K palette.
 * Returns a handful of matching themes and authors for a query typed
 * character by character, so it's kept cheap and rate limited rather than
 * reusing the fuller /api/themes listing endpoint.
 */
export async function GET(request: NextRequest) {
  const rateLimit = searchRateLimiter.check(getClientIP(request));
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: rateLimit.retryAfter
          ? { "Retry-After": String(rateLimit.retryAfter) }
          : undefined,
      },
    );
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .slice(0, MAX_SEARCH_QUERY_LENGTH);

  if (!query) {
    return NextResponse.json({ themes: [], authors: [] });
  }

  const authorTerm = `%${escapeLike(query)}%`;

  const [matchingThemes, matchingAuthors] = await Promise.all([
    db.query.themes.findMany({
      where: buildThemeSearchCondition(query),
      // `downloads` alone leaves ties (0-download themes are common)
      // unordered from one request to the next; `id` breaks that
      // deterministically without affecting the primary sort.
      orderBy: [desc(themes.downloads), asc(themes.id)],
      columns: {
        id: true,
        name: true,
        slug: true,
        downloads: true,
      },
      with: {
        author: {
          columns: {
            username: true,
            name: true,
          },
        },
      },
      limit: THEME_RESULT_LIMIT,
    }),
    db.query.user.findMany({
      where: and(
        sql`(${user.name} ILIKE ${authorTerm} OR ${user.username} ILIKE ${authorTerm})`,
        authorHasThemeCondition(),
      ),
      orderBy: [asc(user.name)],
      columns: {
        id: true,
        name: true,
        username: true,
        image: true,
      },
      limit: AUTHOR_RESULT_LIMIT,
    }),
  ]);

  return NextResponse.json({
    themes: matchingThemes.map((theme) => ({
      id: theme.id,
      name: theme.name,
      slug: theme.slug,
      downloads: theme.downloads,
      author: {
        username: theme.author.username,
        name: theme.author.name,
      },
    })),
    authors: matchingAuthors,
  });
}
