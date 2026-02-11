import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { supabaseAdmin } from "@/lib/supabase";

type RouteParams = { params: Promise<{ author: string; slug: string }> };

/**
 * GET /api/[author]/[slug]
 * Get detailed information about a specific theme
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { author: authorName, slug: themeSlug } = await params;

    const author = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.name, authorName),
    });

    if (!author) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }

    const theme = await db.query.themes.findFirst({
      where: and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)),
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
      },
    });

    if (!theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    return NextResponse.json({
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
      group: theme.group,
      versions: theme.versions.map((v) => ({
        version: v.version,
        versionNotes: v.versionNotes,
        dependencies: v.dependencies,
        createdAt: v.createdAt.toISOString(),
      })),
      createdAt: theme.createdAt.toISOString(),
      updatedAt: theme.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Theme detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch theme" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/[author]/[slug]
 * Delete a theme (requires authentication and ownership)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { author: authorName, slug: themeSlug } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const author = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.name, authorName),
    });

    if (!author) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }

    const theme = await db.query.themes.findFirst({
      where: and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)),
    });

    if (!theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    if (theme.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not own this theme" },
        { status: 403 },
      );
    }

    // Delete screenshot from Supabase Storage
    if (theme.screenshotUrl) {
      try {
        const filename = theme.screenshotUrl.split("/").pop();
        if (filename) {
          await supabaseAdmin.storage.from("stellar").remove([filename]);
        }
      } catch (error) {
        console.error("Failed to delete screenshot:", error);
      }
    }

    // Delete theme (versions will cascade delete)
    await db
      .delete(themes)
      .where(and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Theme delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/[author]/[slug]
 * Update theme metadata (requires authentication and ownership)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { author: authorName, slug: themeSlug } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const author = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.name, authorName),
    });

    if (!author) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }

    const theme = await db.query.themes.findFirst({
      where: and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)),
    });

    if (!theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    if (theme.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not own this theme" },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const colorSchemeId = formData.get("colorSchemeId") as string | null;
    const group = formData.get("group") as string | null;
    const screenshot = formData.get("screenshot") as File | null;

    let screenshotUrl = theme.screenshotUrl;

    if (screenshot && screenshot.size > 0) {
      if (!screenshot.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Screenshot must be an image" },
          { status: 400 },
        );
      }

      if (screenshot.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Screenshot must be less than 5MB" },
          { status: 400 },
        );
      }

      const buffer = await screenshot.arrayBuffer();
      const optimizedImage = await sharp(Buffer.from(buffer))
        .resize(1200, 800, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 100 })
        .toBuffer();

      // Delete old screenshot
      try {
        const oldFilename = theme.screenshotUrl.split("/").pop();
        if (oldFilename) {
          await supabaseAdmin.storage.from("stellar").remove([oldFilename]);
        }
      } catch (error) {
        console.error("Failed to delete old screenshot:", error);
      }

      const filename = `${session.user.id}-${Date.now()}.webp`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("stellar")
        .upload(filename, optimizedImage, {
          contentType: "image/webp",
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload screenshot" },
          { status: 500 },
        );
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("stellar").getPublicUrl(filename);

      screenshotUrl = publicUrl;
    }

    await db
      .update(themes)
      .set({
        name: name || theme.name,
        description: description || null,
        colorSchemeId: colorSchemeId || null,
        group: group || null,
        screenshotUrl,
        updatedAt: new Date(),
      })
      .where(and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Theme metadata update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/[author]/[slug]
 * Increment download count for a theme TODO: add rate limiting
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { author: authorName, slug: themeSlug } = await params;

    const author = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.name, authorName),
    });

    if (!author) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }

    const result = await db
      .update(themes)
      .set({ downloads: sql`${themes.downloads} + 1` })
      .where(and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)))
      .returning({ id: themes.id });

    if (result.length === 0) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Download count increment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
