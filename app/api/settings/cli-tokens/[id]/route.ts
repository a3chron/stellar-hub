import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cliTokens } from "@/lib/db/schema";
import { checkOrigin } from "@/lib/request-auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/settings/cli-tokens/[id]
 *
 * Revokes one of the signed-in user's CLI logins. The CLI using it gets a 401
 * on its next request and is told to run `stellar auth` again.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!checkOrigin(request)) {
      return NextResponse.json(
        { error: "Request origin not allowed" },
        { status: 403 },
      );
    }

    const { id } = await params;
    // Not a uuid can't be a token - and would be a query error, not a 404.
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const deleted = await db
      .delete(cliTokens)
      .where(and(eq(cliTokens.id, id), eq(cliTokens.userId, session.user.id)))
      .returning({ id: cliTokens.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("CLI token revoke error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
