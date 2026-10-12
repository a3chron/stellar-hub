import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { cliTokens } from "@/lib/db/schema";
import { getCliTokenUser, invalidTokenResponse } from "@/lib/request-auth";

/**
 * GET /api/cli/auth/whoami
 *
 * Who the CLI's token belongs to. `stellar publish` and `stellar auth status`
 * call this first, which makes it the natural place to record when a CLI
 * login was last used (shown in settings).
 */
export async function GET(request: NextRequest) {
  try {
    const lookup = await getCliTokenUser(request);
    if (lookup.kind === "none") {
      return apiError(
        401,
        "Not logged in - run `stellar auth` first",
        "unauthorized",
      );
    }
    if (lookup.kind === "invalid") {
      return invalidTokenResponse();
    }

    await db
      .update(cliTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(cliTokens.id, lookup.tokenId));

    const { username, name, image } = lookup.user;
    return NextResponse.json({ username, name, image });
  } catch (error) {
    console.error("CLI whoami error:", error);
    return apiError(500, "Internal server error");
  }
}
