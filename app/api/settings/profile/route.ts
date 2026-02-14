import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import {
  extractValidFilename,
  isValidAvatarFilename,
} from "@/lib/file-validation";
import { supabaseAdmin } from "@/lib/supabase";

// Schema for validating social links
const socialLinksSchema = z
  .object({
    github: z.string().url().optional().or(z.literal("")),
    website: z.string().url().optional().or(z.literal("")),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const bio = formData.get("bio") as string;
    const socialLinksJson = formData.get("socialLinks") as string;
    const avatarFile = formData.get("avatar") as File | null;

    // Parse and validate social links
    let socialLinks: { github?: string; website?: string } = {};
    if (socialLinksJson) {
      try {
        const parsed = JSON.parse(socialLinksJson);
        socialLinks = socialLinksSchema.parse(parsed);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Invalid social links format", details: error.errors },
            { status: 400 },
          );
        }
        return NextResponse.json(
          { error: "Invalid JSON in social links" },
          { status: 400 },
        );
      }
    }

    let avatarUrl = session.user.image;

    // Handle avatar upload
    if (avatarFile) {
      // Validate file
      if (!avatarFile.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Avatar must be an image" },
          { status: 400 },
        );
      }

      if (avatarFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Avatar must be less than 5MB" },
          { status: 400 },
        );
      }

      // Optimize image
      const buffer = await avatarFile.arrayBuffer();
      const optimizedImage = await sharp(Buffer.from(buffer))
        .resize(256, 256, { fit: "cover" })
        .webp({ quality: 90 })
        .toBuffer();

      // Upload to Supabase
      const filename = `avatars/${session.user.id}-${Date.now()}.webp`;
      const { data: _uploadData, error: uploadError } =
        await supabaseAdmin.storage
          .from("screenshots") // Reusing same bucket TODO: better structure
          .upload(filename, optimizedImage, {
            contentType: "image/webp",
            cacheControl: "3600",
          });

      if (uploadError) {
        console.error("Avatar upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload avatar" },
          { status: 500 },
        );
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("screenshots").getPublicUrl(filename);

      avatarUrl = publicUrl;

      // Delete old avatar if it's not from GitHub
      if (session.user.image && !session.user.image.includes("github")) {
        try {
          const oldFilename = extractValidFilename(
            session.user.image,
            isValidAvatarFilename,
          );
          // Additional check: filename should start with user's ID
          if (oldFilename?.startsWith(session.user.id)) {
            await supabaseAdmin.storage
              .from("screenshots")
              .remove([`avatars/${oldFilename}`]);
          } else if (oldFilename) {
            console.warn(
              "Avatar filename doesn't belong to user, skipping deletion",
            );
          }
        } catch (error) {
          console.error("Failed to delete old avatar:", error);
        }
      }
    }

    // Update user in database
    await db
      .update(userTable)
      .set({
        bio: bio || null,
        image: avatarUrl,
        socialLinks,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
