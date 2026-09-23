import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes, themeVersions } from "@/lib/db/schema";
import { validateScreenshotFile } from "@/lib/screenshot-validation";
import { supabaseAdmin } from "@/lib/supabase";
import { themeSlugTaken } from "@/lib/theme-exists";
import { MAX_SLUG_LENGTH } from "@/lib/theme-slug";
import { hasCustomSections } from "@/lib/toml-custom-detect";

// Validation schema
const uploadSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1, "is required")
    .max(MAX_SLUG_LENGTH)
    .regex(/^[a-z0-9-]*$/),
  description: z.string().max(500).optional(),
  config: z.string().min(1).max(100000), // 100KB max
  version: z.string().regex(/^v?\d+\.\d+$/),
  // Optional - an empty field means no stated requirement.
  minStarshipVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  colorSchemeId: z.string().uuid().optional().or(z.literal("")),
  colorMode: z.enum(["dark", "light", "both"]).optional(),
  group: z.string().optional(),
  dependencies: z.string().optional(), // Will be split into array
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

    // Validate screenshot - same rules the form checks on file selection,
    // see lib/screenshot-validation.
    const screenshotError = validateScreenshotFile(screenshot);
    if (screenshotError) {
      return NextResponse.json({ error: screenshotError }, { status: 400 });
    }

    // 3. Validate other fields
    const rawData = {
      name: formData.get("name"),
      slug: formData.get("slug") || undefined,
      description: formData.get("description") || undefined,
      config: formData.get("config"),
      version: formData.get("version"),
      minStarshipVersion: formData.get("minStarshipVersion") || undefined,
      colorSchemeId: formData.get("colorSchemeId") || undefined,
      colorMode: formData.get("colorMode") || undefined,
      group: formData.get("group") || undefined,
      dependencies: formData.get("dependencies") || undefined,
      versionNotes: formData.get("versionNotes") || undefined,
    };

    const data = uploadSchema.parse(rawData);

    if (await themeSlugTaken(session.user.id, data.slug)) {
      return NextResponse.json(
        {
          error:
            "This theme already exists. Update your themes in the settings",
          code: "duplicate_slug",
        },
        { status: 400 },
      );
    }

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
      if (hasCustomSections(data.config)) {
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
        colorMode: data.colorMode ?? "dark",
        group: data.group,
      })
      .returning();

    // 7. Create version
    const normalizedVersion = data.version.replace(/^v/, "");

    const [version] = await db
      .insert(themeVersions)
      .values({
        themeId: newTheme.id,
        version: normalizedVersion,
        configContent: data.config,
        versionNotes: data.versionNotes,
        dependencies: dependenciesArray,
        minStarshipVersion: data.minStarshipVersion ?? null,
      })
      .returning();

    return NextResponse.json({
      success: !!version,
      slug: data.slug,
      author: session.user.username,
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
