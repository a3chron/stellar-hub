import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findDraftCodeForSlug, normalizeDraftCode } from "@/lib/drafts";
import { themeSlugTaken } from "@/lib/theme-exists";
import { MAX_SLUG_LENGTH } from "@/lib/theme-slug";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Live duplicate check for the upload wizard's slug field, so a clash with
 * one of the signed-in user's own themes shows up while they're still typing
 * the name - not after they've already picked a screenshot and pasted a
 * config. The unique index on (authorId, slug) is what actually settles a
 * race at publish time.
 *
 * Also answers `draftCode` when another of the user's drafts already holds
 * the slug, so the wizard can offer to continue that draft instead. `draft`
 * names the draft being edited, which never counts against itself.
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

  if (await themeSlugTaken(session.user.id, slug)) {
    return NextResponse.json({
      available: false,
      error: "You already have a theme with this slug",
    });
  }

  const draftParam = request.nextUrl.searchParams.get("draft");
  const draftCode = await findDraftCodeForSlug(
    session.user.id,
    slug,
    draftParam ? normalizeDraftCode(draftParam) : null,
  );
  if (draftCode) {
    return NextResponse.json({
      available: false,
      draftCode,
      error: "You already have a draft with this slug",
    });
  }

  return NextResponse.json({ available: true });
}
