import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(
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
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const colorSchemeId = formData.get("colorSchemeId") as string | null;
    const group = formData.get("group") as string | null;
    const screenshot = formData.get("screenshot") as File | null;

    let screenshotUrl = theme.screenshotUrl;

    // Handle screenshot update
    if (screenshot && screenshot.size > 0) {
      // Validate screenshot
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

      // Optimize image
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

      // Upload new screenshot
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

    // Update theme metadata
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
      .where(eq(themes.id, themeId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Theme metadata update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
