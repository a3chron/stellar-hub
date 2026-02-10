import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(
  _request: NextRequest,
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

    // Delete screenshot from Supabase Storage
    if (theme.screenshotUrl) {
      try {
        const filename = theme.screenshotUrl.split("/").pop();
        if (filename) {
          await supabaseAdmin.storage.from("screenshots").remove([filename]);
        }
      } catch (error) {
        console.error("Failed to delete screenshot:", error);
        // TODO: dont continue with deletion even if screenshot removal fails
      }
    }

    // Delete theme (versions will cascade delete)
    await db.delete(themes).where(eq(themes.id, themeId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Theme delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
