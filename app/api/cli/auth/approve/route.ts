import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, validationFailed } from "@/lib/api-error";
import { normalizeUserCode } from "@/lib/cli-auth";
import { db } from "@/lib/db";
import { cliAuthRequests } from "@/lib/db/schema";
import type { CliAuthRequest } from "@/lib/db/types";
import { getSessionUser } from "@/lib/request-auth";

const approveSchema = z.object({
  userCode: z.string({ required_error: "is required" }),
  action: z.enum(["approve", "deny"], {
    errorMap: () => ({ message: 'must be "approve" or "deny"' }),
  }),
});

function invalidCode() {
  return apiError(
    404,
    "This code isn't valid - check it against your terminal, or run `stellar auth` again",
    "invalid_code",
  );
}

/** The answer for a request that has already been decided. */
function alreadyDecided(row: CliAuthRequest, userId: string) {
  // Idempotent for the user who decided it (a double click, a retried
  // request); anyone else is told the code is spent.
  if (row.userId === userId) {
    return NextResponse.json({ status: row.status });
  }
  return apiError(
    409,
    "This code was already used by someone else",
    "already_used",
  );
}

/**
 * POST /api/cli/auth/approve
 *
 * The Approve/Deny buttons on /cli/authorize. Session only (a CLI token can't
 * approve another CLI login), and Origin-checked, since this is what hands a
 * terminal access to the signed-in account.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getSessionUser(request);
    if (!authResult.ok) {
      return authResult.response;
    }
    const userId = authResult.user.id;

    const body = await request.json().catch(() => null);
    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) {
      return validationFailed(parsed.error);
    }

    const userCode = normalizeUserCode(parsed.data.userCode);
    if (!userCode) {
      return invalidCode();
    }

    const row = await db.query.cliAuthRequests.findFirst({
      where: eq(cliAuthRequests.userCode, userCode),
    });
    if (!row) {
      return invalidCode();
    }

    if (row.expiresAt <= new Date()) {
      return apiError(
        410,
        "This code expired - run `stellar auth` again",
        "expired_token",
      );
    }

    if (row.status !== "pending") {
      return alreadyDecided(row, userId);
    }

    const status = parsed.data.action === "approve" ? "approved" : "denied";
    const [updated] = await db
      .update(cliAuthRequests)
      .set({ status, userId })
      .where(
        and(
          eq(cliAuthRequests.id, row.id),
          eq(cliAuthRequests.status, "pending"),
        ),
      )
      .returning();

    if (!updated) {
      // Lost a race: decided in another tab, or already collected by the CLI.
      const current = await db.query.cliAuthRequests.findFirst({
        where: eq(cliAuthRequests.id, row.id),
      });
      return current ? alreadyDecided(current, userId) : invalidCode();
    }

    return NextResponse.json({ status: updated.status });
  } catch (error) {
    console.error("CLI auth approve error:", error);
    return apiError(500, "Internal server error");
  }
}
