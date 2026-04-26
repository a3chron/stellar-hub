import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";

export async function GET() {
  try {
    const result = await db
      .select({
        totalDownloads: sql<number>`COALESCE(SUM(${themes.downloads}), 0)`,
      })
      .from(themes);

    return NextResponse.json({ totalDownloads: result[0].totalDownloads });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
