// app/api/themes/download-count/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  author: z.string(),
  slug: z.string(),
});

// Rate limiting could be added here with Upstash Redis or similar
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { author, slug } = schema.parse(body);

    // Find author
    const authorUser = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.name, author),
    });

    if (!authorUser) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }

    // Find and increment theme
    const theme = await db.query.themes.findFirst({
      where: and(eq(themes.authorId, authorUser.id), eq(themes.slug, slug)),
    });

    if (!theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    await db
      .update(themes)
      .set({ downloads: theme.downloads + 1 })
      .where(eq(themes.id, theme.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Download count error:", error);
    return NextResponse.json(
      { error: "Failed to increment download count" },
      { status: 500 },
    );
  }
}
