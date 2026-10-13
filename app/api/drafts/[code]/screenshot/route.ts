import { and, eq, gt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { themeDrafts } from "@/lib/db/schema";
import type { ThemeDraft } from "@/lib/db/types";
import {
  draftNotFound,
  expiryFrom,
  findLiveDraft,
  purgeExpiredDrafts,
  removeScreenshotObjects,
  SCREENSHOT_BUCKET,
  serializeOne,
} from "@/lib/drafts";
import { getDraftUser } from "@/lib/request-auth";
import { validateScreenshotFile } from "@/lib/screenshot-validation";
import { supabaseAdmin } from "@/lib/supabase";

type RouteParams = { params: Promise<{ code: string }> };

// Decoding limits, checked from the image header before any decoding.
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_DIMENSION = 8000;
const DECODABLE_FORMATS = new Set(["png", "jpeg", "webp"]);

function invalidScreenshot(message: string) {
  return apiError(400, message, "invalid_screenshot");
}

function unreadable() {
  return invalidScreenshot(
    "That file couldn't be read as an image - try exporting it again as PNG",
  );
}

function notApplicable() {
  return apiError(
    400,
    "A new version uses the theme's existing screenshot - change it in the theme's settings",
    "not_applicable",
  );
}

/**
 * Swaps the draft's screenshot path inside a transaction that locks the row,
 * so a publish running at the same time either sees the old path or the new
 * one - never a path whose object is about to be deleted. Returns the updated
 * row and the path it replaced, or null when the draft is gone.
 */
async function swapScreenshotPath(
  draftId: string,
  path: string | null,
): Promise<{ row: ThemeDraft; previous: string | null } | null> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [current] = await tx
      .select({ screenshotPath: themeDrafts.screenshotPath })
      .from(themeDrafts)
      .where(and(eq(themeDrafts.id, draftId), gt(themeDrafts.expiresAt, now)))
      .for("update");
    if (!current) {
      return null;
    }

    const [row] = await tx
      .update(themeDrafts)
      .set({ screenshotPath: path, updatedAt: now, expiresAt: expiryFrom(now) })
      .where(eq(themeDrafts.id, draftId))
      .returning();
    return { row, previous: current.screenshotPath };
  });
}

/**
 * PUT /api/drafts/[code]/screenshot
 *
 * Multipart, one `screenshot` part (PNG, JPEG or WebP, at most 4 MB). The
 * image is decoded and re-encoded with sharp - which is also what rejects a
 * file that only claims to be an image - and uploaded straight to its final
 * `<userId>-<timestamp>.webp` name, so publishing never has to move it.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getDraftUser(request);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;
    const { code } = await params;

    await purgeExpiredDrafts(user.id);

    const draft = await findLiveDraft(user.id, code);
    if (!draft) {
      return draftNotFound();
    }
    if (draft.kind !== "theme") {
      return notApplicable();
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return invalidScreenshot(
        "Expected a multipart/form-data body with a screenshot part",
      );
    }

    const file = form.get("screenshot");
    if (file === null || typeof file === "string") {
      return invalidScreenshot("The screenshot part is missing");
    }

    const fileProblem = validateScreenshotFile(file);
    if (fileProblem) {
      return invalidScreenshot(fileProblem);
    }

    const input = Buffer.from(await file.arrayBuffer());

    // The header first: a few kilobytes can claim to be a gigapixel image
    // that would take seconds and gigabytes to decode. The Content-Type of
    // the part is only what the client says - this is what the file is.
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(input, {
        limitInputPixels: MAX_INPUT_PIXELS,
      }).metadata();
    } catch {
      return unreadable();
    }

    if (!metadata.format || !DECODABLE_FORMATS.has(metadata.format)) {
      return invalidScreenshot("Screenshot must be a PNG, JPG, or WebP image.");
    }
    const { width, height } = metadata;
    if (
      !width ||
      !height ||
      width > MAX_DIMENSION ||
      height > MAX_DIMENSION ||
      width * height > MAX_INPUT_PIXELS
    ) {
      return invalidScreenshot(
        `Screenshot is too large - keep it within ${MAX_DIMENSION} × ${MAX_DIMENSION} pixels and 40 megapixels.`,
      );
    }

    let image: Buffer;
    try {
      image = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .resize(1200, 800, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      return unreadable();
    }

    const path = `${user.id}-${Date.now()}.webp`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, image, { contentType: "image/webp", cacheControl: "3600" });
    if (uploadError) {
      console.error("Draft screenshot upload error:", uploadError);
      return apiError(500, "Failed to upload the screenshot");
    }

    const swapped = await swapScreenshotPath(draft.id, path);
    if (!swapped) {
      // Published or deleted while the image was uploading.
      await removeScreenshotObjects([path]);
      return draftNotFound();
    }

    if (swapped.previous && swapped.previous !== path) {
      await removeScreenshotObjects([swapped.previous]);
    }

    return NextResponse.json(
      await serializeOne(swapped.row, { includeConfig: true }),
    );
  } catch (error) {
    console.error("Draft screenshot error:", error);
    return apiError(500, "Internal server error");
  }
}

/**
 * DELETE /api/drafts/[code]/screenshot
 *
 * Removes the draft's screenshot (the object too).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getDraftUser(request);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;
    const { code } = await params;

    await purgeExpiredDrafts(user.id);

    const draft = await findLiveDraft(user.id, code);
    if (!draft) {
      return draftNotFound();
    }
    // Nothing to remove on a version draft - it never has its own screenshot.
    if (draft.kind !== "theme" || !draft.screenshotPath) {
      return NextResponse.json(
        await serializeOne(draft, { includeConfig: true }),
      );
    }

    const swapped = await swapScreenshotPath(draft.id, null);
    if (!swapped) {
      return draftNotFound();
    }
    await removeScreenshotObjects([swapped.previous]);

    return NextResponse.json(
      await serializeOne(swapped.row, { includeConfig: true }),
    );
  } catch (error) {
    console.error("Draft screenshot delete error:", error);
    return apiError(500, "Internal server error");
  }
}
