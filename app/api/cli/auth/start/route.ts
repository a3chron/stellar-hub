import { and, count, eq, gt, sql } from "drizzle-orm";
import { after, type NextRequest, NextResponse } from "next/server";
import { apiError, isPlainObject, isUniqueViolation } from "@/lib/api-error";
import { APP_URL } from "@/lib/app-url";
import {
  CLI_AUTH_EXPIRES_IN_SECONDS,
  CLI_AUTH_INTERVAL_SECONDS,
  CLI_AUTH_MAX_PENDING_PER_IP,
  CLI_AUTH_MAX_PENDING_TOTAL,
  formatUserCode,
  generateDeviceCode,
  hashSecret,
  parseClientLabel,
  randomCode,
} from "@/lib/cli-auth";
import { purgeExpiredLoginRequests } from "@/lib/cli-login-requests";
import { db } from "@/lib/db";
import { cliAuthRequests } from "@/lib/db/schema";
import { purgeExpiredDraftsGlobally } from "@/lib/drafts";
import { getClientNetworkHash } from "@/lib/rate-limit";

/**
 * POST /api/cli/auth/start
 *
 * Starts a `stellar auth` device login: the CLI gets a secret device code to
 * poll /api/cli/auth/token with, and a short user code to show while the user
 * approves it at /cli/authorize. Unauthenticated by design.
 *
 * Rate limited in the database rather than in memory, because each Vercel
 * instance has its own memory: at most a few pending requests per network,
 * and a global cap so a flood from many addresses can't fill the table.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const client = parseClientLabel(
      isPlainObject(body) ? body.client : undefined,
    );
    const ipHash = getClientNetworkHash(request.headers);
    const now = new Date();

    // Housekeeping with no cron to run it: expired drafts of users who never
    // come back. Runs after the response and never fails the request.
    after(() => purgeExpiredDraftsGlobally(50));

    await purgeExpiredLoginRequests(now);

    const [{ total, fromHere }] = await db
      .select({
        total: count(),
        fromHere:
          sql<number>`count(*) filter (where ${cliAuthRequests.ipHash} = ${ipHash})`.mapWith(
            Number,
          ),
      })
      .from(cliAuthRequests)
      .where(
        and(
          eq(cliAuthRequests.status, "pending"),
          gt(cliAuthRequests.expiresAt, now),
        ),
      );

    if (fromHere >= CLI_AUTH_MAX_PENDING_PER_IP) {
      return apiError(
        429,
        "Too many unfinished logins from your network - approve or wait out one of them first",
        "rate_limited",
      );
    }
    if (total >= CLI_AUTH_MAX_PENDING_TOTAL) {
      return apiError(
        429,
        "Too many logins in progress right now - try again in a few minutes",
        "rate_limited",
      );
    }

    const deviceCode = generateDeviceCode();
    const expiresAt = new Date(
      now.getTime() + CLI_AUTH_EXPIRES_IN_SECONDS * 1000,
    );

    // A user code collision is retried rather than checked up front: with
    // 32^8 codes and only live requests occupying them it is vanishingly rare,
    // and the unique index is the cheaper guard.
    let userCode = "";
    for (let attempt = 1; ; attempt++) {
      userCode = randomCode(8);
      try {
        await db.insert(cliAuthRequests).values({
          deviceCodeHash: hashSecret(deviceCode),
          userCode,
          client,
          ipHash,
          expiresAt,
        });
        break;
      } catch (error) {
        if (
          attempt < 5 &&
          isUniqueViolation(error, "cli_auth_requests_user_code_unique")
        ) {
          continue;
        }
        throw error;
      }
    }

    const shownCode = formatUserCode(userCode);

    return NextResponse.json({
      deviceCode,
      userCode: shownCode,
      verificationUrl: `${APP_URL}/cli/authorize`,
      verificationUrlComplete: `${APP_URL}/cli/authorize?code=${shownCode}`,
      expiresIn: CLI_AUTH_EXPIRES_IN_SECONDS,
      interval: CLI_AUTH_INTERVAL_SECONDS,
    });
  } catch (error) {
    console.error("CLI auth start error:", error);
    return apiError(500, "Internal server error");
  }
}
