import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";

//TODO: some kind of rate limits

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { author, slug } = body ?? {};

    if (!author || !slug) {
      return NextResponse.json(
        { error: "Missing author or slug" },
        { status: 400 },
      );
    }

    const result = await db
      .update(themes)
      .set({
        downloads: sql`${themes.downloads} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(themes.authorId, author), eq(themes.slug, slug)))
      .returning({ id: themes.id });

    if (result.length === 0) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Download count increment failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
