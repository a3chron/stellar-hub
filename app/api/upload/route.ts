import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes, themeVersions } from "@/lib/db/schema";
import { supabaseAdmin } from "@/lib/supabase";

// Validation schema
const uploadSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .max(50)
    .regex(/^[a-z0-9-]*$/),
  description: z.string().max(500).optional(),
  config: z.string().min(1).max(100000), // 100KB max
  version: z.string().regex(/^v?\d+\.\d+$/),
  minStarshipVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  colorSchemeId: z.string().uuid().optional().or(z.literal("")),
  group: z.string().optional(),
  dependencies: z.string().optional(), // Will be split into array
  installationNotes: z.string().max(1000).optional(),
  versionNotes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse form data
    const formData = await request.formData();
    const screenshot = formData.get("screenshot") as File;

    if (!screenshot) {
      return NextResponse.json(
        { error: "Screenshot is required" },
        { status: 400 },
      );
    }

    // Validate screenshot
    if (!screenshot.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Screenshot must be an image" },
        { status: 400 },
      );
    }

    if (screenshot.size > 5 * 1024 * 1024) {
      // 5MB max
      return NextResponse.json(
        { error: "Screenshot must be less than 5MB" },
        { status: 400 },
      );
    }

    // 3. Validate other fields
    const rawData = {
      name: formData.get("name"),
      slug: formData.get("slug") || undefined,
      description: formData.get("description") || undefined,
      config: formData.get("config"),
      version: formData.get("version"),
      minStarshipVersion: formData.get("minStarshipVersion"),
      colorSchemeId: formData.get("colorSchemeId") || undefined,
      group: formData.get("group") || undefined,
      dependencies: formData.get("dependencies") || undefined,
      installationNotes: formData.get("installationNotes") || undefined,
      versionNotes: formData.get("versionNotes") || undefined,
    };

    const data = uploadSchema.parse(rawData);

    // Parse dependencies (one per line)
    const dependenciesArray = data.dependencies
      ? data.dependencies
          .split("\n")
          .map((d) => d.trim())
          .filter((d) => d.length > 0)
      : undefined;

    // 4. Validate TOML config
    try {
      // Basic TOML validation
      if (!data.config.includes("[") || !data.config.includes("]")) {
        throw new Error("Invalid TOML format");
      }

      // Check for custom commands (security warning)
      if (data.config.includes("[custom.")) {
        console.warn("Theme contains custom commands:", data.slug);
      }
    } catch (_error) {
      return NextResponse.json(
        { error: "Invalid Starship config (TOML)" },
        { status: 400 },
      );
    }

    // 5. Optimize and upload screenshot
    const buffer = await screenshot.arrayBuffer();
    const optimizedImage = await sharp(Buffer.from(buffer))
      .resize(1200, 800, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate unique filename
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

    // Get public URL
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("stellar").getPublicUrl(filename);

    // 6. Check if theme already exists
    const existingTheme = await db.query.themes.findFirst({
      where: (themes, { and, eq }) =>
        and(eq(themes.authorId, session.user.id), eq(themes.slug, data.slug)),
    });

    let themeId: string;

    if (existingTheme) {
      // Update existing theme
      const [updated] = await db
        .update(themes)
        .set({
          name: data.name,
          description: data.description,
          screenshotUrl: publicUrl,
          colorSchemeId: data.colorSchemeId || null,
          group: data.group,
          updatedAt: new Date(),
        })
        .where(eq(themes.id, existingTheme.id))
        .returning();

      themeId = updated.id;
    } else {
      // Create new theme
      const [newTheme] = await db
        .insert(themes)
        .values({
          authorId: session.user.id,
          slug: data.slug,
          name: data.name,
          description: data.description,
          screenshotUrl: publicUrl,
          colorSchemeId: data.colorSchemeId || null,
          group: data.group,
        })
        .returning();

      themeId = newTheme.id;
    }

    // 7. Create version
    const normalizedVersion = data.version.replace(/^v/, "");

    const [version] = await db
      .insert(themeVersions)
      .values({
        themeId,
        version: normalizedVersion,
        configContent: data.config,
        versionNotes: data.versionNotes,
        dependencies: dependenciesArray,
        minStarshipVersion: data.minStarshipVersion,
        installationNotes: data.installationNotes,
      })
      .returning();

    return NextResponse.json({
      success: !!version,
      slug: data.slug,
      author: session.user.name,
      version: normalizedVersion,
    });
  } catch (error) {
    console.error("Upload error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
