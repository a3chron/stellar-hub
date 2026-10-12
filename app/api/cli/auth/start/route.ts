import { and, count, eq, gt, lt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { apiError, isPlainObject, isUniqueViolation } from "@/lib/api-error";
import { APP_URL } from "@/lib/app-url";
import {
  CLI_AUTH_EXPIRES_IN_SECONDS,
  CLI_AUTH_INTERVAL_SECONDS,
  CLI_AUTH_MAX_PENDING_PER_IP,
  formatUserCode,
  generateDeviceCode,
  hashSecret,
  parseClientLabel,
  randomCode,
} from "@/lib/cli-auth";
import { db } from "@/lib/db";
import { cliAuthRequests } from "@/lib/db/schema";
import { getClientIP } from "@/lib/rate-limit";

// Expired requests are kept a little past their expiry before being purged,
// so a CLI that is still polling gets its one `expired_token` rather than a
// confusing `invalid_grant`.
const EXPIRED_GRACE_MS = 10 * 60 * 1000;

/**
 * POST /api/cli/auth/start
 *
 * Starts a `stellar auth` device login: the CLI gets a secret device code to
 * poll /api/cli/auth/token with, and a short user code to show while the user
 * approves it at /cli/authorize. Unauthenticated by design.
 *
 * Rate limited in the database rather than in memory, because each Vercel
 * instance has its own memory: at most a few pending requests per IP hash.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const client = parseClientLabel(
      isPlainObject(body) ? body.client : undefined,
    );
    const ipHash = getClientIP(request);
    const now = new Date();

    await db
      .delete(cliAuthRequests)
      .where(
        lt(
          cliAuthRequests.expiresAt,
          new Date(now.getTime() - EXPIRED_GRACE_MS),
        ),
      );

    const [{ pending }] = await db
      .select({ pending: count() })
      .from(cliAuthRequests)
      .where(
        and(
          eq(cliAuthRequests.ipHash, ipHash),
          eq(cliAuthRequests.status, "pending"),
          gt(cliAuthRequests.expiresAt, now),
        ),
      );

    if (pending >= CLI_AUTH_MAX_PENDING_PER_IP) {
      return apiError(
        429,
        "Too many unfinished logins from your network - approve or wait out one of them first",
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
