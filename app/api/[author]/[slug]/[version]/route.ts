import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { themes, themeVersions } from "@/lib/db/schema";
import type { ThemeVersion } from "@/lib/db/types";
import { hasCustomSections } from "@/lib/toml-custom-detect";
import { usernameEquals } from "@/lib/username";

type RouteParams = {
  params: Promise<{ author: string; slug: string; version: string }>;
};

/**
 * Helper to find theme by author name and slug
 */
async function findThemeByAuthorAndSlug(authorName: string, themeSlug: string) {
  const author = await db.query.user.findFirst({
    where: (user) => usernameEquals(user.username, authorName),
  });

  if (!author) {
    return { error: "Author not found", status: 404 };
  }

  const theme = await db.query.themes.findFirst({
    where: and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)),
  });

  if (!theme) {
    return { error: "Theme not found", status: 404 };
  }

  return { author, theme };
}

/**
 * GET /api/[author]/[slug]/[version]
 * Download the TOML config for a specific version (or "latest")
 * Use ?preview=true to get JSON response for UI display
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const {
      author: authorName,
      slug: themeSlug,
      version: versionIn,
    } = await params;

    // Check if preview mode (for UI to display config)
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get("preview") === "true";

    const result = await findThemeByAuthorAndSlug(authorName, themeSlug);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    const { theme } = result;

    // Normalize version (remove 'v' prefix if present)
    const normalizedVersion = versionIn.replace(/^v/, "");

    let version: ThemeVersion | undefined;
    if (normalizedVersion === "latest") {
      version = await db.query.themeVersions.findFirst({
        where: eq(themeVersions.themeId, theme.id),
        orderBy: (versions, { desc }) => [desc(versions.createdAt)],
      });
    } else {
      version = await db.query.themeVersions.findFirst({
        where: and(
          eq(themeVersions.themeId, theme.id),
          eq(themeVersions.version, normalizedVersion),
        ),
      });
    }

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Preview mode returns JSON with config content and metadata
    if (preview) {
      // Check for custom commands to warn in UI. Shares one detector with the
      // versions list, so a config can never be flagged in one place and look
      // clean in another - see lib/toml-custom-detect.ts.
      const hasCustomCommands = hasCustomSections(version.configContent);

      return NextResponse.json({
        version: version.version,
        configContent: version.configContent,
        hasCustomCommands,
        versionNotes: version.versionNotes,
        dependencies: version.dependencies,
        minStarshipVersion: version.minStarshipVersion,
        createdAt: version.createdAt.toISOString(),
      });
    }

    // Default: download as file
    return new NextResponse(version.configContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${themeSlug}-${version.version}.toml"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download theme" },
      { status: 500 },
    );
  }
}
