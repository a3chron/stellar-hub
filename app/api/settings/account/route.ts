import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { account, session, themes, user as userTable } from "@/lib/db/schema";
import {
  extractValidFilename,
  isValidAvatarFilename,
  isValidScreenshotFilename,
} from "@/lib/file-validation";
import { supabaseAdmin } from "@/lib/supabase";

const deleteAccountSchema = z.object({
  // Typing the handle is the confirmation step - this endpoint destroys
  // published work, so a stray click must not be enough to trigger it.
  confirmUsername: z.string().trim(),
});

/**
 * DELETE /api/settings/account
 *
 * Deletes the signed-in user's account: their profile, every theme they
 * published and all of its versions, their sessions and their linked sign-in
 * providers. This is what makes the right to erasure (GDPR Art. 17) something
 * a user can exercise themselves rather than by emailing and waiting.
 *
 * Irreversible, and it breaks every published link to that author's themes -
 * hence the typed confirmation.
 */
export async function DELETE(request: NextRequest) {
  try {
    const authSession = await auth.api.getSession({ headers: await headers() });

    if (!authSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = deleteAccountSchema.safeParse(body);

    if (
      !parsed.success ||
      parsed.data.confirmUsername.toLowerCase() !==
        authSession.user.username?.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Type your username exactly to confirm deletion" },
        { status: 400 },
      );
    }

    const userId = authSession.user.id;

    // Collected before the delete, because the theme rows are about to be
    // cascade-deleted and their screenshot URLs would go with them.
    const ownedThemes = await db
      .select({ screenshotUrl: themes.screenshotUrl })
      .from(themes)
      .where(eq(themes.authorId, userId));

    const avatarUrl = authSession.user.image;

    // `session` and `account` reference `user` WITHOUT `onDelete: cascade`
    // (see lib/db/schema.ts), so they have to be cleared explicitly and in
    // this order or the final delete fails on a foreign key. `themes` does
    // cascade, and `theme_versions` cascades from `themes`.
    await db.transaction(async (tx) => {
      await tx.delete(session).where(eq(session.userId, userId));
      await tx.delete(account).where(eq(account.userId, userId));
      await tx.delete(userTable).where(eq(userTable.id, userId));
    });

    // Storage cleanup runs only after the database delete has committed. If it
    // were done first, a failed transaction would leave a live account whose
    // images had already been destroyed; this way the worst case is an orphaned
    // file, which is recoverable and logged.
    //
    // Theme screenshots and avatars live in different buckets.
    // `user.image` is writable through better-auth's /update-user, so a
    // shape-only check is not enough: someone could point their avatar at
    // another user's file and have this delete it. Avatar filenames are
    // written as `${userId}-${timestamp}.webp`, so requiring the prefix
    // confines the delete to files this account actually owns. Same guard as
    // app/api/settings/profile/route.ts.
    await deleteStoredFile(
      "screenshots",
      avatarUrl,
      (filename) =>
        isValidAvatarFilename(filename) && filename.startsWith(`${userId}-`),
      (name) => `avatars/${name}`,
    );

    for (const theme of ownedThemes) {
      await deleteStoredFile(
        "stellar",
        theme.screenshotUrl,
        isValidScreenshotFilename,
        (name) => name,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Best-effort removal of one stored object. A failure here is logged and
 * swallowed: the account is already gone, and an orphaned file must not turn a
 * completed deletion into an error the user sees.
 */
async function deleteStoredFile(
  bucket: string,
  url: string | null | undefined,
  isValid: (filename: string) => boolean,
  toPath: (filename: string) => string,
) {
  if (!url) {
    return;
  }

  try {
    const filename = extractValidFilename(url, isValid);
    if (!filename) {
      return;
    }
    await supabaseAdmin.storage.from(bucket).remove([toPath(filename)]);
  } catch (error) {
    console.error(`Failed to delete ${bucket} object for deleted user:`, error);
  }
}
