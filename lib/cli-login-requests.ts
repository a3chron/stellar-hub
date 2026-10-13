import { lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { cliAuthRequests } from "@/lib/db/schema";

// Expired login requests are kept a little past their expiry before being
// deleted, so a CLI that is still polling gets its one `expired_token` rather
// than a confusing `invalid_grant`. With the 10 minute lifetime that makes
// about 20 minutes from `stellar auth` to deletion.
const EXPIRED_GRACE_MS = 10 * 60 * 1000;

/** Deletes every login request that expired more than the grace period ago. */
export async function purgeExpiredLoginRequests(now = new Date()) {
  await db
    .delete(cliAuthRequests)
    .where(
      lt(cliAuthRequests.expiresAt, new Date(now.getTime() - EXPIRED_GRACE_MS)),
    );
}
