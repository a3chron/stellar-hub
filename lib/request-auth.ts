import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { APP_URL } from "@/lib/app-url";
import { auth, trustedOrigins } from "@/lib/auth";
import { hashSecret } from "@/lib/cli-auth";
import { db } from "@/lib/db";
import { cliTokens, user } from "@/lib/db/schema";
import type { User } from "@/lib/db/types";

// Request authentication for the CLI-facing routes only: whoami, token
// revocation and /api/drafts/**. Every other route keeps reading the session
// directly - a CLI token is deliberately not a way into the rest of the API.

export type RequestUser = Pick<User, "id" | "username" | "name" | "image">;

export type CliTokenLookup =
  // No Authorization header at all.
  | { kind: "none" }
  // A header that isn't a live token: malformed, unknown or revoked.
  | { kind: "invalid" }
  | { kind: "valid"; user: RequestUser; tokenId: string };

export type DraftAuth =
  | { ok: true; user: RequestUser; via: "cli" | "web" }
  | { ok: false; response: NextResponse };

const BEARER_PATTERN = /^Bearer\s+(stl_[A-Za-z0-9_-]+)$/;

export function invalidTokenResponse() {
  return apiError(
    401,
    "This CLI login is invalid or was revoked - run `stellar auth` to log in again",
    "invalid_token",
  );
}

export async function getCliTokenUser(
  request: Request,
): Promise<CliTokenLookup> {
  const header = request.headers.get("authorization");
  if (header === null) {
    return { kind: "none" };
  }

  const match = header.trim().match(BEARER_PATTERN);
  if (!match) {
    return { kind: "invalid" };
  }

  const [row] = await db
    .select({
      tokenId: cliTokens.id,
      id: user.id,
      username: user.username,
      name: user.name,
      image: user.image,
    })
    .from(cliTokens)
    .innerJoin(user, eq(cliTokens.userId, user.id))
    .where(eq(cliTokens.tokenHash, hashSecret(match[1])))
    .limit(1);

  if (!row) {
    return { kind: "invalid" };
  }

  const { tokenId, ...tokenUser } = row;
  return { kind: "valid", user: tokenUser, tokenId };
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function originOf(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Where our own pages can be served from: better-auth's trusted origins
 * (without the local dev servers in production), the configured app and auth
 * URLs, and the deployment's own Vercel URL so preview deploys work too.
 * Built once - all of it comes from the environment.
 */
const ALLOWED_ORIGINS: ReadonlySet<string> = (() => {
  const origins = new Set<string>();
  const production = process.env.NODE_ENV === "production";

  for (const trusted of trustedOrigins) {
    const origin = originOf(trusted);
    if (!origin) {
      continue;
    }
    if (production && LOCAL_HOSTNAMES.has(new URL(origin).hostname)) {
      continue;
    }
    origins.add(origin);
  }

  const vercelUrl = process.env.VERCEL_URL;
  for (const url of [
    APP_URL,
    process.env.BETTER_AUTH_URL,
    vercelUrl ? `https://${vercelUrl}` : undefined,
  ]) {
    const origin = originOf(url);
    if (origin) {
      origins.add(origin);
    }
  }

  return origins;
})();

/**
 * Whether a session-authenticated, state-changing request came from one of
 * our own pages. These routes have no CSRF token, and the session cookie alone
 * must not be enough for another site to approve a CLI login or edit a draft.
 * Bearer requests never need this - a token can't be attached cross-site.
 */
export function checkOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}

function isSafeMethod(method: string) {
  return method === "GET" || method === "HEAD";
}

/** The signed-in browser user, with the Origin check for non-GET requests. */
export async function getSessionUser(request: Request): Promise<DraftAuth> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      ok: false,
      response: apiError(401, "You need to sign in first", "unauthorized"),
    };
  }

  if (!isSafeMethod(request.method) && !checkOrigin(request)) {
    return {
      ok: false,
      response: apiError(403, "Request origin not allowed", "invalid_origin"),
    };
  }

  let { username } = session.user;
  if (!username) {
    // Always set in the database, but better-auth types additional fields as
    // optional on the session - read it from the row rather than guess.
    const row = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { username: true },
    });
    if (!row) {
      return {
        ok: false,
        response: apiError(401, "You need to sign in first", "unauthorized"),
      };
    }
    username = row.username;
  }

  return {
    ok: true,
    via: "web",
    user: {
      id: session.user.id,
      username,
      name: session.user.name,
      image: session.user.image ?? null,
    },
  };
}

/**
 * Records that a CLI token was used, so settings shows when each login was
 * last active. At most every 10 minutes per token - a `stellar publish` makes
 * several requests in a row, and one write is plenty. Best-effort: a failed
 * update must not fail the request it rides on.
 */
async function touchCliToken(tokenId: string) {
  try {
    await db
      .update(cliTokens)
      .set({ lastUsedAt: sql`now()` })
      .where(
        and(
          eq(cliTokens.id, tokenId),
          or(
            isNull(cliTokens.lastUsedAt),
            lt(cliTokens.lastUsedAt, sql`now() - interval '10 minutes'`),
          ),
        ),
      );
  } catch (error) {
    console.error("Failed to record CLI token use:", error);
  }
}

/**
 * The user behind a /api/drafts/** request. If an Authorization header is
 * present it alone decides: a bad token is a 401, never a quiet fallback to
 * whatever session cookie the same client might also carry.
 */
export async function getDraftUser(request: Request): Promise<DraftAuth> {
  const bearer = await getCliTokenUser(request);

  if (bearer.kind === "invalid") {
    return { ok: false, response: invalidTokenResponse() };
  }
  if (bearer.kind === "valid") {
    await touchCliToken(bearer.tokenId);
    return { ok: true, user: bearer.user, via: "cli" };
  }

  return getSessionUser(request);
}
