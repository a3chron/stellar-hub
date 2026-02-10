import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes, themeVersions } from "@/lib/db/schema";

const updateConfigSchema = z.object({
  version: z.string().regex(/^\d+\.\d+$/),
  config: z.string().min(1).max(100000),
  minStarshipVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  dependencies: z.string().optional(),
  versionNotes: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ themeId: string }> },
) {
  try {
    const { themeId } = await params;

    // Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find theme and verify ownership
    const theme = await db.query.themes.findFirst({
      where: eq(themes.id, themeId),
      with: {
        versions: {
          orderBy: (versions, { desc }) => [desc(versions.createdAt)],
          limit: 1,
        },
      },
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

    // Parse form data
    const formData = await request.formData();
    const rawData = {
      version: formData.get("version"),
      config: formData.get("config"),
      minStarshipVersion: formData.get("minStarshipVersion"),
      dependencies: formData.get("dependencies") || undefined,
      versionNotes: formData.get("versionNotes") || undefined,
    };

    const data = updateConfigSchema.parse(rawData);

    // Check if version already exists
    const existingVersion = await db.query.themeVersions.findFirst({
      where: and(
        eq(themeVersions.themeId, themeId),
        eq(themeVersions.version, data.version),
      ),
    });

    if (existingVersion) {
      return NextResponse.json(
        { error: `Version ${data.version} already exists` },
        { status: 400 },
      );
    }

    // Parse dependencies
    const dependenciesArray = data.dependencies
      ? data.dependencies
          .split("\n")
          .map((d) => d.trim())
          .filter((d) => d.length > 0)
      : undefined;

    // Validate TOML config
    try {
      if (!data.config.includes("[") || !data.config.includes("]")) {
        throw new Error("Invalid TOML format");
      }

      if (data.config.includes("[custom.")) {
        console.warn("Theme contains custom commands:", theme.slug);
      }
    } catch (_error) {
      return NextResponse.json(
        { error: "Invalid Starship config (TOML)" },
        { status: 400 },
      );
    }

    // Create new version
    await db.insert(themeVersions).values({
      themeId,
      version: data.version,
      configContent: data.config,
      versionNotes: data.versionNotes,
      dependencies: dependenciesArray,
      minStarshipVersion: data.minStarshipVersion,
    });

    // Update theme's updatedAt
    await db
      .update(themes)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(themes.id, themeId));

    return NextResponse.json({ success: true, version: data.version });
  } catch (error) {
    console.error("Config update error:", error);

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
