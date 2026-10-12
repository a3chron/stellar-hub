import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { apiError, isPlainObject } from "@/lib/api-error";
import {
  CLI_AUTH_INTERVAL_SECONDS,
  generateCliToken,
  hashSecret,
} from "@/lib/cli-auth";
import { db } from "@/lib/db";
import { cliAuthRequests, cliTokens, user } from "@/lib/db/schema";
import { getCliTokenUser, invalidTokenResponse } from "@/lib/request-auth";

// A poll that arrives this soon after the previous one is told to slow down.
// One second of slack under the advertised interval absorbs network jitter.
const MIN_POLL_GAP_MS = (CLI_AUTH_INTERVAL_SECONDS - 1) * 1000;

function invalidGrant() {
  return apiError(
    400,
    "Unknown or already used login request - run `stellar auth` again",
    "invalid_grant",
  );
}

/**
 * POST /api/cli/auth/token
 *
 * The CLI's poll while the user decides at /cli/authorize. Once approved, the
 * request row is deleted and exchanged for a token in one transaction, so a
 * device code can only ever be redeemed once. The terminal answers
 * (`access_denied`, `expired_token`) are also given exactly once.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const deviceCode =
      isPlainObject(body) && typeof body.deviceCode === "string"
        ? body.deviceCode
        : null;
    if (!deviceCode) {
      return invalidGrant();
    }

    const row = await db.query.cliAuthRequests.findFirst({
      where: eq(cliAuthRequests.deviceCodeHash, hashSecret(deviceCode)),
    });
    if (!row) {
      return invalidGrant();
    }

    const now = new Date();

    if (row.expiresAt <= now) {
      await db.delete(cliAuthRequests).where(eq(cliAuthRequests.id, row.id));
      return apiError(
        400,
        "The login request expired - run `stellar auth` again",
        "expired_token",
      );
    }

    if (row.status === "denied") {
      await db.delete(cliAuthRequests).where(eq(cliAuthRequests.id, row.id));
      return apiError(
        400,
        "The login was denied in the browser",
        "access_denied",
      );
    }

    if (row.status === "approved") {
      const issued = await db.transaction(async (tx) => {
        // Claimed with a conditional delete, so two polls racing each other
        // can't both mint a token for the same approval.
        const [claimed] = await tx
          .delete(cliAuthRequests)
          .where(
            and(
              eq(cliAuthRequests.id, row.id),
              eq(cliAuthRequests.status, "approved"),
            ),
          )
          .returning();
        if (!claimed?.userId) {
          return null;
        }

        const owner = await tx.query.user.findFirst({
          where: eq(user.id, claimed.userId),
          columns: { username: true, name: true },
        });
        if (!owner) {
          return null;
        }

        const token = generateCliToken();
        await tx.insert(cliTokens).values({
          tokenHash: hashSecret(token),
          label: claimed.client,
          userId: claimed.userId,
        });
        return { token, user: owner };
      });

      if (!issued) {
        return invalidGrant();
      }
      return NextResponse.json(issued);
    }

    // Still pending.
    const tooSoon =
      row.lastPolledAt !== null &&
      now.getTime() - row.lastPolledAt.getTime() < MIN_POLL_GAP_MS;

    await db
      .update(cliAuthRequests)
      .set({ lastPolledAt: now })
      .where(eq(cliAuthRequests.id, row.id));

    if (tooSoon) {
      return apiError(
        400,
        `Polling too fast - wait at least ${CLI_AUTH_INTERVAL_SECONDS} seconds between polls`,
        "slow_down",
      );
    }

    return apiError(
      400,
      "Waiting for the login to be approved in the browser",
      "authorization_pending",
    );
  } catch (error) {
    console.error("CLI auth token error:", error);
    return apiError(500, "Internal server error");
  }
}

/**
 * DELETE /api/cli/auth/token
 *
 * `stellar auth logout`: revokes the token the request is made with. The CLI
 * treats a 401 here as success too - an already revoked token is logged out.
 */
export async function DELETE(request: NextRequest) {
  try {
    const lookup = await getCliTokenUser(request);
    if (lookup.kind !== "valid") {
      return invalidTokenResponse();
    }

    await db.delete(cliTokens).where(eq(cliTokens.id, lookup.tokenId));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("CLI token revoke error:", error);
    return apiError(500, "Internal server error");
  }
}
