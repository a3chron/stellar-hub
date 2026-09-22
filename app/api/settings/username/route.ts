import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes, user as userTable } from "@/lib/db/schema";
import { getClientIP, usernameCheckRateLimiter } from "@/lib/rate-limit";
import { isUsernameTaken, validateUsername } from "@/lib/username";

/**
 * Availability check for the sign-up form and the settings field.
 *
 * Authentication is deliberately not required - the sign-up form has to call
 * this before an account exists - which makes it a taken/free oracle over the
 * whole user table, including accounts that have published nothing and so do
 * not show up anywhere else. Hence the rate limit: enough to type a handle
 * out, not enough to enumerate.
 */
export async function GET(request: NextRequest) {
  const rateLimit = usernameCheckRateLimiter.check(getClientIP(request));
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: rateLimit.retryAfter
          ? { "Retry-After": String(rateLimit.retryAfter) }
          : undefined,
      },
    );
  }

  const username = request.nextUrl.searchParams.get("username") ?? "";

  const validation = validateUsername(username);
  if (!validation.ok) {
    return NextResponse.json({ available: false, error: validation.error });
  }

  const taken = await isUsernameTaken(username);

  return NextResponse.json({
    available: !taken,
    error: taken ? "That username is taken" : undefined,
  });
}

const changeUsernameSchema = z.object({
  username: z.string().trim(),
});

/**
 * Changes the signed-in user's handle.
 *
 * The handle is the `/[author]` URL segment and the `author` half of
 * `stellar apply <author>/<theme>`, so changing it rewrites the address of
 * every theme the account has published - links other people saved, and the
 * identifier already baked into their local stellar cache. That is why the
 * change is refused once anything is published: the alternative is silently
 * breaking other people's prompts.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = changeUsernameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 },
      );
    }

    const { username } = parsed.data;

    const validation = validateUsername(username);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Changing only the capitalisation is a no-op for every lookup (they all
    // compare lowercased), so allow it without the published-themes check.
    const isSameHandle =
      username.toLowerCase() === session.user.username?.toLowerCase();

    if (!isSameHandle) {
      const published = await db
        .select({ id: themes.id })
        .from(themes)
        .where(eq(themes.authorId, session.user.id))
        .limit(1);

      if (published.length > 0) {
        return NextResponse.json(
          {
            error:
              "Your username can't be changed once you've published a theme - it's part of every theme's address and the command people use to apply it.",
          },
          { status: 409 },
        );
      }

      if (await isUsernameTaken(username, session.user.id)) {
        return NextResponse.json(
          { error: "That username is taken" },
          { status: 409 },
        );
      }
    }

    try {
      // The published-themes check above and this write are separate
      // statements, so an upload landing in between could publish a theme
      // under the old handle and have the rename orphan it a moment later.
      // Re-asserting the condition here means the rename simply does not apply
      // if that happened.
      const updated = await db
        .update(userTable)
        .set({ username, updatedAt: new Date() })
        .where(
          and(
            eq(userTable.id, session.user.id),
            isSameHandle
              ? undefined
              : sql`NOT EXISTS (SELECT 1 FROM ${themes} WHERE ${themes.authorId} = ${session.user.id})`,
          ),
        )
        .returning({ id: userTable.id });

      if (updated.length === 0) {
        return NextResponse.json(
          {
            error:
              "Your username can't be changed once you've published a theme - it's part of every theme's address and the command people use to apply it.",
          },
          { status: 409 },
        );
      }
    } catch (error) {
      // The unique index is what actually settles a race between two people
      // claiming the same handle; the check above only makes the common case
      // a friendly message instead of a 500.
      if (
        error instanceof Error &&
        error.message.includes("unique_username_lower")
      ) {
        return NextResponse.json(
          { error: "That username is taken" },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, username });
  } catch (error) {
    console.error("Username update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
