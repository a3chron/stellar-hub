import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { themeSlugTaken } from "@/lib/theme-exists";
import { MAX_SLUG_LENGTH } from "@/lib/theme-slug";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Live duplicate check for the upload form's auto-generated slug field, so a
 * clash with one of the signed-in user's own themes shows up while they're
 * still typing the name - not after they've already picked a screenshot and
 * pasted a config. Backed by the same lookup /api/upload falls back to at
 * submit time (see themeSlugTaken); the unique index on (authorId, slug) is
 * what actually settles a race between the two.
 *
 * Auth is required (unlike the username check) since this only ever answers
 * about the caller's own themes - there is no oracle over other users' slugs
 * to protect against here.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get("slug") ?? "";

  if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ available: false, error: "Invalid slug" });
  }

  const taken = await themeSlugTaken(session.user.id, slug);

  return NextResponse.json({
    available: !taken,
    error: taken ? "You already have a theme with this slug" : undefined,
  });
}
