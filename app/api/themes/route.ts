import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { desc, asc, ilike, sql, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "trending";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const colorScheme = searchParams.get("colorScheme");
    const author = searchParams.get("author");

    // Build query
    let query = db.query.themes.findMany({
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
        colorScheme: true,
        versions: {
          orderBy: (versions, { desc }) => [desc(versions.createdAt)],
          limit: 1, // Only get latest version
        },
      },
      limit,
      offset,
    });

    // Apply filters
    const conditions = [];

    if (search) {
      conditions.push(
        sql`(${themes.name} ILIKE ${`%${search}%`} OR ${themes.description} ILIKE ${`%${search}%`})`,
      );
    }

    if (colorScheme) {
      conditions.push(eq(themes.colorSchemeId, colorScheme));
    }

    if (author) {
      conditions.push(eq(themes.authorId, author));
    }

    // Apply sorting
    let orderBy;
    switch (sort) {
      case "trending":
        // Trending = most downloads in last 7 days (simplified: just by total downloads)
        orderBy = [desc(themes.downloads), desc(themes.createdAt)];
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
        name: theme.author.name,
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
        total: results.length, // In production, you'd want a separate count query
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
