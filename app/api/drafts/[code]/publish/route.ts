import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { purgeExpiredDrafts } from "@/lib/drafts";
import { PublishError, publishDraft } from "@/lib/publish";
import { getDraftUser } from "@/lib/request-auth";

type RouteParams = { params: Promise<{ code: string }> };

/**
 * POST /api/drafts/[code]/publish
 *
 * Turns a complete draft into a published theme or version (see
 * lib/publish.ts). On success the draft is gone; on any refusal it is left
 * untouched.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getDraftUser(request);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;
    const { code } = await params;

    await purgeExpiredDrafts(user.id);

    try {
      return NextResponse.json(await publishDraft(user, code));
    } catch (error) {
      if (error instanceof PublishError) {
        return error.toResponse();
      }
      throw error;
    }
  } catch (error) {
    console.error("Draft publish error:", error);
    return apiError(500, "Internal server error");
  }
}
