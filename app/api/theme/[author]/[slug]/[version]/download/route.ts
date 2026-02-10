import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { themes, themeVersions } from "@/lib/db/schema";
import type { ThemeVersion } from "@/lib/db/types";

export async function GET(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ author: string; slug: string; version: string }> },
) {
  try {
    const {
      author: authorName,
      slug: themeSlug,
      version: versionIn,
    } = await params;

    // Find author
    const author = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.name, authorName),
    });

    if (!author) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }

    // Find theme
    const theme = await db.query.themes.findFirst({
      where: and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)),
    });

    if (!theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    // Normalize version (remove 'v' prefix if present)
    const normalizedVersion = versionIn.replace(/^v/, "");

    // Find version (or latest if version is "latest")
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

    // Return TOML content
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
