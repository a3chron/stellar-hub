import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { themes, themeVersions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { author: string; slug: string; version: string } },
) {
  try {
    // Find author
    const author = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.name, params.author),
    });

    if (!author) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }

    // Find theme
    const theme = await db.query.themes.findFirst({
      where: and(eq(themes.authorId, author.id), eq(themes.slug, params.slug)),
    });

    if (!theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    // Normalize version (remove 'v' prefix if present)
    const normalizedVersion = params.version.replace(/^v/, "");

    // Find version (or latest if version is "latest")
    let version;
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

    // Increment download count (fire and forget)
    db.update(themes)
      .set({ downloads: theme.downloads + 1 })
      .where(eq(themes.id, theme.id))
      .execute()
      .catch((err) => console.error("Failed to increment downloads:", err));

    // Return TOML content
    return new NextResponse(version.configContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${params.slug}-${version.version}.toml"`,
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
