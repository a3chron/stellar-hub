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

// GitHub usernames: alphanumeric and hyphens, no leading/trailing hyphen,
// max 39 chars.
const githubUsernameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

// The bio is rendered on the public author page, so it needs a server-side
// cap - the form's maxLength is a hint to the browser, not a limit anyone
// posting to this endpoint directly has to respect. Matches the 500 the
// upload route enforces on theme descriptions.
const bioSchema = z.string().max(500, "Bio must be 500 characters or less");

// Schema for validating social links. `github` is stored as a plain
// username (the author page renders it as https://github.com/<username>),
// but a pasted profile URL is accepted and normalized down to the username.
const socialLinksSchema = z
  .object({
    github: z
      .string()
      .trim()
      .transform((v) =>
        v
          .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
          .replace(/\/+$/, ""),
      )
      .refine((v) => v === "" || githubUsernameRegex.test(v), {
        message: "GitHub should be just your username, e.g. a3chron",
      })
      .optional(),
    website: z
      .string()
      .trim()
      .url("Website must be a full URL, e.g. https://example.com")
      .optional()
      .or(z.literal("")),
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
    const bioRaw = formData.get("bio");
    const socialLinksJson = formData.get("socialLinks") as string;
    const avatarFile = formData.get("avatar") as File | null;

    // `undefined` means "not submitted", and such a field is left alone
    // below rather than cleared - a request that only uploads an avatar
    // shouldn't wipe the user's bio and links.
    let bio: string | null | undefined;
    if (bioRaw !== null) {
      const parsedBio = bioSchema.safeParse(String(bioRaw));
      if (!parsedBio.success) {
        return NextResponse.json(
          { error: parsedBio.error.errors[0]?.message ?? "Invalid bio" },
          { status: 400 },
        );
      }
      bio = parsedBio.data || null;
    }

    // Parse and validate social links
    let socialLinks: { github?: string; website?: string } | undefined;
    if (socialLinksJson) {
      try {
        const parsed = JSON.parse(socialLinksJson);
        socialLinks = socialLinksSchema.parse(parsed);
        // Don't persist empty strings - the author page checks truthiness,
        // and {} keeps the stored shape clean.
        if (!socialLinks.github) {
          delete socialLinks.github;
        }
        if (!socialLinks.website) {
          delete socialLinks.website;
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            {
              error: error.errors[0]?.message ?? "Invalid social links format",
              details: error.errors,
            },
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
        ...(bio !== undefined && { bio }),
        image: avatarUrl,
        ...(socialLinks !== undefined && { socialLinks }),
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
