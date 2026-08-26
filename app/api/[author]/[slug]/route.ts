import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import {
  extractValidFilename,
  isValidScreenshotFilename,
} from "@/lib/file-validation";
import { downloadRateLimiter, getClientIP } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase";

type RouteParams = { params: Promise<{ author: string; slug: string }> };

// Mirrors the limits /api/upload enforces at create time, so a field that
// can't exceed 500 characters on a new theme can't exceed it on an edit
// either. Every field is optional: PATCH callers may send a subset, and an
// omitted or blank one keeps/clears the stored value as before.
const patchMetadataSchema = z.object({
  name: z
    .string()
    .trim()
    .max(100, "Name must be 100 characters or less")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional(),
  group: z
    .string()
    .trim()
    .max(100, "Group must be 100 characters or less")
    .optional(),
  colorSchemeId: z
    .string()
    .uuid("Invalid color scheme")
    .optional()
    .or(z.literal("")),
  colorMode: z.enum(["dark", "light", "both"]).optional(),
});

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
        const filename = extractValidFilename(
          theme.screenshotUrl,
          isValidScreenshotFilename,
        );
        if (filename) {
          await supabaseAdmin.storage.from("stellar").remove([filename]);
        } else {
          console.warn(
            "Skipping deletion of invalid screenshot filename:",
            theme.screenshotUrl,
          );
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
    const screenshot = formData.get("screenshot") as File | null;

    // Only forward fields that were actually submitted, so an omitted field
    // stays absent rather than becoming the string "null".
    const submitted: Record<string, string> = {};
    for (const field of [
      "name",
      "description",
      "group",
      "colorSchemeId",
      "colorMode",
    ]) {
      const value = formData.get(field);
      if (value !== null) {
        submitted[field] = String(value);
      }
    }

    const parsed = patchMetadataSchema.safeParse(submitted);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.errors[0]?.message ?? "Validation failed",
          details: parsed.error.errors,
        },
        { status: 400 },
      );
    }

    // This is a PATCH: a field the caller didn't send keeps its stored value
    // instead of being cleared. (The edit form always submits every field, so
    // clearing a description there still works - it sends an empty one.)
    const updates: Partial<typeof themes.$inferInsert> = {};
    if (parsed.data.name) {
      // A blank or whitespace-only name means "leave it alone" rather than
      // "call the theme nothing".
      updates.name = parsed.data.name;
    }
    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description || null;
    }
    if (parsed.data.group !== undefined) {
      updates.group = parsed.data.group || null;
    }
    if (parsed.data.colorSchemeId !== undefined) {
      updates.colorSchemeId = parsed.data.colorSchemeId || null;
    }
    if (parsed.data.colorMode !== undefined) {
      updates.colorMode = parsed.data.colorMode;
    }

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

      const oldFilename = extractValidFilename(
        theme.screenshotUrl,
        isValidScreenshotFilename,
      );
      const filename = oldFilename ?? `${session.user.id}-${Date.now()}.webp`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("stellar")
        .upload(filename, optimizedImage, {
          contentType: "image/webp",
          cacheControl: "43200",
          upsert: true, // overwrite existing
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
        ...updates,
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
 * Increment download count for a theme
 * Rate limited: 1 increment per IP per theme per 30 minutes
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { author: authorName, slug: themeSlug } = await params;

    // Per-theme rate limit check
    const clientIP = getClientIP(request);
    const rateLimitKey = `${clientIP}:${authorName}/${themeSlug}`;
    const rateLimit = downloadRateLimiter.check(rateLimitKey);

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter),
          },
        },
      );
    }

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
