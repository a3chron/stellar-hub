import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes, themeVersions } from "@/lib/db/schema";
import type { ThemeVersion } from "@/lib/db/types";

type RouteParams = {
  params: Promise<{ author: string; slug: string; version: string }>;
};

const newVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+$/),
  config: z.string().min(1).max(100000),
  minStarshipVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  dependencies: z.string().optional(),
  versionNotes: z.string().max(500).optional(),
});

/**
 * Helper to find theme by author name and slug
 */
async function findThemeByAuthorAndSlug(authorName: string, themeSlug: string) {
  const author = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.name, authorName),
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
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const {
      author: authorName,
      slug: themeSlug,
      version: versionIn,
    } = await params;

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
 * POST /api/[author]/[slug]/[version]
 * Add a new version to an existing theme (requires authentication and ownership)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const {
      author: authorName,
      slug: themeSlug,
      version: versionParam,
    } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await findThemeByAuthorAndSlug(authorName, themeSlug);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    const { theme } = result;

    if (theme.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not own this theme" },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const rawData = {
      version: formData.get("version") || versionParam,
      config: formData.get("config"),
      minStarshipVersion: formData.get("minStarshipVersion"),
      dependencies: formData.get("dependencies") || undefined,
      versionNotes: formData.get("versionNotes") || undefined,
    };

    const data = newVersionSchema.parse(rawData);

    // Check if version already exists
    const existingVersion = await db.query.themeVersions.findFirst({
      where: and(
        eq(themeVersions.themeId, theme.id),
        eq(themeVersions.version, data.version),
      ),
    });

    if (existingVersion) {
      return NextResponse.json(
        { error: `Version ${data.version} already exists` },
        { status: 400 },
      );
    }

    const dependenciesArray = data.dependencies
      ? data.dependencies
          .split("\n")
          .map((d) => d.trim())
          .filter((d) => d.length > 0)
      : undefined;

    // Validate TOML config
    if (!data.config.includes("[") || !data.config.includes("]")) {
      return NextResponse.json(
        { error: "Invalid Starship config (TOML)" },
        { status: 400 },
      );
    }

    if (data.config.includes("[custom.")) {
      console.warn("Theme contains custom commands:", themeSlug);
    }

    await db.insert(themeVersions).values({
      themeId: theme.id,
      version: data.version,
      configContent: data.config,
      versionNotes: data.versionNotes,
      dependencies: dependenciesArray,
      minStarshipVersion: data.minStarshipVersion,
    });

    await db
      .update(themes)
      .set({ updatedAt: new Date() })
      .where(eq(themes.id, theme.id));

    return NextResponse.json({ success: true, version: data.version });
  } catch (error) {
    console.error("Version creation error:", error);

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
