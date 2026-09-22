import { asc, desc, eq, getTableName, or, type SQL, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { colorModeEnum, themes, user } from "@/lib/db/schema";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Escapes the wildcards ILIKE would otherwise interpret, so a search for
 * "100%" or "a_c" matches those characters literally instead of everything.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Parses a query-string integer, falling back to `fallback` for anything
 * unparseable and clamping the rest into [min, max]. This endpoint is public
 * and unauthenticated, so a junk `?limit=` should be a quiet default rather
 * than a stack trace in the logs.
 */
function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === null) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "trending";
    // parseInt alone would let "abc" through as NaN and "-5" through as a
    // negative, both of which Postgres rejects outright - a 500 for what is
    // really a malformed request.
    const limit = clampInt(searchParams.get("limit"), 20, 1, 100);
    const offset = clampInt(
      searchParams.get("offset"),
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const colorSchemeParam = searchParams.get("colorScheme");
    if (colorSchemeParam && !UUID_REGEX.test(colorSchemeParam)) {
      return NextResponse.json(
        { error: "colorScheme must be a UUID" },
        { status: 400 },
      );
    }
    const colorScheme = colorSchemeParam;
    const colorModeParam = searchParams.get("colorMode");
    const colorMode = colorModeEnum.enumValues.includes(
      colorModeParam as (typeof colorModeEnum.enumValues)[number],
    )
      ? (colorModeParam as (typeof colorModeEnum.enumValues)[number])
      : null;
    const author = searchParams.get("author");
    const authorName = searchParams.get("authorName");

    // Apply filters
    const conditions = [];

    if (search) {
      const term = `%${escapeLike(search)}%`;
      conditions.push(
        sql`(${themes.name} ILIKE ${term} OR ${themes.description} ILIKE ${term})`,
      );
    }

    if (colorScheme) {
      conditions.push(eq(themes.colorSchemeId, colorScheme));
    }

    if (colorMode === "dark") {
      conditions.push(
        or(eq(themes.colorMode, "dark"), eq(themes.colorMode, "both"))!,
      );
    } else if (colorMode === "light") {
      conditions.push(
        or(eq(themes.colorMode, "light"), eq(themes.colorMode, "both"))!,
      );
    } else if (colorMode === "both") {
      conditions.push(eq(themes.colorMode, "both"));
    }

    if (author) {
      conditions.push(eq(themes.authorId, author));
    }

    if (authorName) {
      // Prefix match on the author handle (used by CLI tab completion) -
      // the handle is what `stellar apply <author>/<theme>` takes, so
      // completing against the display name would suggest unusable values.
      //
      // The subquery spells its identifiers out with sql.identifier rather
      // than interpolating `user.id` / `user.username`. The relational query
      // builder rewrites *every* Column chunk in `where` to the root table's
      // alias, so interpolated user columns come out as "themes"."id" and
      // "themes"."username" - the latter does not exist, and the endpoint
      // 500s for any ?authorName=. The names are read off the schema so a
      // column rename still carries through.
      const prefix = escapeLike(authorName);
      const userTable = sql.identifier(getTableName(user));
      conditions.push(
        sql`${themes.authorId} IN (SELECT ${userTable}.${sql.identifier(user.id.name)} FROM ${userTable} WHERE ${userTable}.${sql.identifier(user.username.name)} ILIKE ${`${prefix}%`})`,
      );
    }

    // Apply sorting
    let orderBy: SQL[];
    switch (sort) {
      case "trending":
        // Time-decay score: downloads / (age_in_hours + 2)^1.5
        // Newer themes with downloads rank higher; no time window cutoff
        orderBy = [
          desc(
            sql`${themes.downloads} / POWER(EXTRACT(EPOCH FROM (NOW() - ${themes.createdAt})) / 3600 + 2, 1.5)`,
          ),
          desc(themes.createdAt),
        ];
        break;
      case "recent":
        orderBy = [desc(themes.createdAt)];
        break;
      case "popular":
        orderBy = [desc(themes.downloads)];
        break;
      case "name":
        orderBy = [asc(themes.name)];
        break;
      default:
        orderBy = [desc(themes.downloads)];
    }

    const results = await db.query.themes.findMany({
      where:
        conditions.length > 0
          ? sql`${sql.join(conditions, sql` AND `)}`
          : undefined,
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        colorScheme: true,
        versions: {
          orderBy: (versions, { desc }) => [desc(versions.createdAt)],
          limit: 1,
        },
      },
      orderBy,
      limit,
      offset,
    });

    // Format response
    const formattedResults = results.map((theme) => ({
      id: theme.id,
      author: {
        id: theme.author.id,
        // `name` is the author *handle*, not the display name. Released CLI
        // versions read this field as the author half of
        // `stellar apply <author>/<theme>` (see internal/completion), so it has
        // to keep meaning what it has always meant. `displayName` carries the
        // free-form name for anything that wants to show a person rather than
        // address them.
        name: theme.author.username,
        username: theme.author.username,
        displayName: theme.author.name,
        image: theme.author.image,
      },
      name: theme.name,
      slug: theme.slug,
      description: theme.description,
      screenshotUrl: theme.screenshotUrl,
      downloads: theme.downloads,
      colorScheme: theme.colorScheme?.name,
      latestVersion: theme.versions[0]?.version,
      createdAt: theme.createdAt.toISOString(),
      updatedAt: theme.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      themes: formattedResults,
      pagination: {
        limit,
        offset,
        total: results.length,
      },
    });
  } catch (error) {
    console.error("Themes listing error:", error);
    return NextResponse.json(
      { error: "Failed to fetch themes" },
      { status: 500 },
    );
  }
}
