import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { themes, themeVersions } from "@/lib/db/schema";
import type { ThemeVersion } from "@/lib/db/types";
import { getSessionUser } from "@/lib/request-auth";
import { hasCustomSections } from "@/lib/toml-custom-detect";
import { usernameEquals } from "@/lib/username";
import {
  pickLatestVersion,
  VERSION_PATTERN,
  versionFloor,
} from "@/lib/versions";

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
      // The numerically highest version (1.10 after 1.9), not the most
      // recently created one - first the numbers, then that one row.
      const numbers = await db
        .select({ id: themeVersions.id, version: themeVersions.version })
        .from(themeVersions)
        .where(eq(themeVersions.themeId, theme.id));
      const latest = pickLatestVersion(numbers);
      version = latest
        ? await db.query.themeVersions.findFirst({
            where: eq(themeVersions.id, latest.id),
          })
        : undefined;
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

/**
 * DELETE /api/[author]/[slug]/[version]
 * Delete one version of a theme (requires authentication and ownership).
 *
 * Any version but the theme's only one; deleting the latest makes the one
 * below it the latest. The deleted number is remembered in
 * `themes.highestDeletedVersion` and publishing only accepts newer numbers
 * (lib/publish.ts), so it never comes back with different content. That
 * keeps `stellar` caches, which are keyed by version number, honest - an
 * `@2.0` someone already has can't silently turn into another config.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const {
      author: authorName,
      slug: themeSlug,
      version: versionIn,
    } = await params;

    // Session only (no CLI token), with the Origin check every
    // cookie-authenticated, state-changing route gets.
    const sessionUser = await getSessionUser(request);
    if (!sessionUser.ok) {
      return sessionUser.response;
    }
    const { user } = sessionUser;

    // Same normalization as GET, but "latest" is a moving target - deleting
    // has to name the exact version.
    const version = versionIn.replace(/^v/, "");
    if (version === "latest") {
      return apiError(
        400,
        'Name the exact version to delete, like 1.2 - "latest" isn\'t accepted here',
        "invalid_version",
      );
    }
    if (!VERSION_PATTERN.test(version)) {
      return apiError(
        400,
        `"${versionIn}" isn't a version number like 1.2`,
        "invalid_version",
      );
    }

    const author = await db.query.user.findFirst({
      where: (users) => usernameEquals(users.username, authorName),
    });

    if (!author) {
      return apiError(404, "Author not found", "author_not_found");
    }

    const theme = await db.query.themes.findFirst({
      where: and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)),
    });

    if (!theme) {
      return apiError(404, "Theme not found", "theme_not_found");
    }

    if (theme.authorId !== user.id) {
      return apiError(403, "You do not own this theme", "not_theme_owner");
    }

    return await db.transaction(async (tx) => {
      // Locked like publishVersion() in lib/publish.ts does, so a publish or
      // another delete of this theme runs strictly before or after this one:
      // the only-version check can't go stale, and a publish can't slip in a
      // number that is being deleted right now.
      const [locked] = await tx
        .select({
          id: themes.id,
          highestDeletedVersion: themes.highestDeletedVersion,
        })
        .from(themes)
        .where(and(eq(themes.id, theme.id), eq(themes.authorId, user.id)))
        .for("update");
      if (!locked) {
        return apiError(404, "Theme not found", "theme_not_found");
      }

      const versions = await tx
        .select({ id: themeVersions.id, version: themeVersions.version })
        .from(themeVersions)
        .where(eq(themeVersions.themeId, locked.id));

      const target = versions.find((existing) => existing.version === version);
      if (!target) {
        return apiError(
          404,
          `Version ${version} not found`,
          "version_not_found",
        );
      }

      if (versions.length === 1) {
        return apiError(
          409,
          "A theme needs at least one version - delete the whole theme instead",
          "only_version",
        );
      }

      await tx.delete(themeVersions).where(eq(themeVersions.id, target.id));

      // themes.updatedAt stays as it is: it drives the "Latest" sorting, and
      // removing a version isn't news.
      const floor = versionFloor(version, locked.highestDeletedVersion);
      if (floor !== locked.highestDeletedVersion) {
        await tx
          .update(themes)
          .set({ highestDeletedVersion: floor })
          .where(eq(themes.id, locked.id));
      }

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error("Version delete error:", error);
    return apiError(500, "Internal server error");
  }
}
