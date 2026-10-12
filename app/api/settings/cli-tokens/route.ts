import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cliTokens } from "@/lib/db/schema";

/**
 * GET /api/settings/cli-tokens
 *
 * The signed-in user's CLI logins, newest first. Session only - a CLI token
 * can't list (or revoke) its siblings.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokens = await db
      .select({
        id: cliTokens.id,
        label: cliTokens.label,
        createdAt: cliTokens.createdAt,
        lastUsedAt: cliTokens.lastUsedAt,
      })
      .from(cliTokens)
      .where(eq(cliTokens.userId, session.user.id))
      .orderBy(desc(cliTokens.createdAt));

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("CLI token list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
