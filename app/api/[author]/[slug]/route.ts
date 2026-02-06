import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { author: string; slug: string } },
) {
  try {
    // First find the author by name
    const author = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.name, params.author),
    });

    if (!author) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }

    // Then find the theme
    const theme = await db.query.themes.findFirst({
      where: and(eq(themes.authorId, author.id), eq(themes.slug, params.slug)),
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            image: true,
            bio: true,
          },
        },
        versions: {
          orderBy: (versions, { desc }) => [desc(versions.createdAt)],
        },
        colorScheme: true,
        group: true,
      },
    });

    if (!theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    // Format response
    const response = {
      id: theme.id,
      author: {
        id: theme.author.id,
        name: theme.author.name,
        image: theme.author.image,
        bio: theme.author.bio,
      },
      name: theme.name,
      slug: theme.slug,
      description: theme.description,
      screenshotUrl: theme.screenshotUrl,
      downloads: theme.downloads,
      colorScheme: theme.colorScheme?.name,
      group: theme.group
        ? {
            id: theme.group.id,
            name: theme.group.name,
            description: theme.group.description,
          }
        : null,
      versions: theme.versions.map((v) => ({
        version: v.version,
        versionNotes: v.versionNotes,
        dependencies: v.dependencies,
        installationNotes: v.installationNotes,
        createdAt: v.createdAt.toISOString(),
      })),
      createdAt: theme.createdAt.toISOString(),
      updatedAt: theme.updatedAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Theme detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch theme" },
      { status: 500 },
    );
  }
}
