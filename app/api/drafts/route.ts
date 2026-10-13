import { and, desc, eq } from "drizzle-orm";
import { after, type NextRequest, NextResponse } from "next/server";
import { apiError, isUniqueViolation, validationFailed } from "@/lib/api-error";
import { db } from "@/lib/db";
import { themeDrafts, themes } from "@/lib/db/schema";
import { MAX_LIVE_DRAFTS } from "@/lib/draft-shared";
import {
  colorSchemeExists,
  createDraftSchema,
  draftExists,
  duplicateSlug,
  expiryFrom,
  fieldError,
  findDraftCodeForSlug,
  findVersionDraftCode,
  insertDraftWithinLimit,
  invalidConfig,
  notAnObject,
  purgeExpiredDrafts,
  purgeExpiredDraftsGlobally,
  readJsonObject,
  serializeDrafts,
  serializeOne,
  tomlError,
} from "@/lib/drafts";
import { getDraftUser } from "@/lib/request-auth";
import { themeSlugTaken } from "@/lib/theme-exists";
import { calculateNextVersion, pickLatestVersion } from "@/lib/versions";

/**
 * GET /api/drafts
 *
 * The caller's live drafts, most recently touched first, without their
 * configs. Session or CLI token.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getDraftUser(request);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;

    await purgeExpiredDrafts(user.id);

    const rows = await db
      .select()
      .from(themeDrafts)
      .where(eq(themeDrafts.userId, user.id))
      .orderBy(desc(themeDrafts.updatedAt));

    return NextResponse.json({
      drafts: await serializeDrafts(rows, { includeConfig: false }),
    });
  } catch (error) {
    console.error("Draft list error:", error);
    return apiError(500, "Internal server error");
  }
}

// Checked last, right before inserting: someone at the limit who tries to
// start a draft that already exists should be sent to that draft, not told
// to delete one.
function tooManyDrafts() {
  return apiError(
    409,
    `You already have ${MAX_LIVE_DRAFTS} drafts - publish or delete one first`,
    "too_many_drafts",
  );
}

/**
 * POST /api/drafts
 *
 * Starts a draft: `kind: "theme"` for a new theme, `kind: "version"` for a new
 * version of one of the caller's themes. A version draft starts out as a copy
 * of the latest version - its config (marked `configSource: "latest"`), its
 * dependencies and minimum Starship version - bumped to the next major.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getDraftUser(request);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user, via } = authResult;

    const body = await readJsonObject(request);
    if (!body) {
      return notAnObject();
    }
    const parsed = createDraftSchema.safeParse(body);
    if (!parsed.success) {
      return validationFailed(parsed.error);
    }
    const input = parsed.data;

    if (input.config) {
      const problem = tomlError(input.config);
      if (problem) {
        return invalidConfig(problem);
      }
    }

    await purgeExpiredDrafts(user.id);
    // Other users' expired drafts too - after the response, never fatal.
    after(() => purgeExpiredDraftsGlobally(50));

    const now = new Date();
    const timestamps = {
      createdAt: now,
      updatedAt: now,
      expiresAt: expiryFrom(now),
    };

    if (input.kind === "theme") {
      if (await themeSlugTaken(user.id, input.slug)) {
        return duplicateSlug();
      }
      const existing = await findDraftCodeForSlug(user.id, input.slug);
      if (existing) {
        return draftExists(existing);
      }
      if (
        input.colorSchemeId &&
        !(await colorSchemeExists(input.colorSchemeId))
      ) {
        return fieldError("colorSchemeId", "is not a known color scheme");
      }

      try {
        const row = await insertDraftWithinLimit({
          userId: user.id,
          kind: "theme",
          slug: input.slug,
          name: input.name ?? null,
          description: input.description ?? null,
          group: input.group ?? null,
          colorMode: input.colorMode ?? null,
          colorSchemeId: input.colorSchemeId ?? null,
          dependencies: input.dependencies ?? [],
          minStarshipVersion: input.minStarshipVersion ?? null,
          // A new theme always has a version; null means "the default".
          version: input.version ?? "1.0",
          versionNotes: input.versionNotes ?? null,
          config: input.config ?? null,
          configSource: input.config ? via : null,
          configUpdatedAt: input.config ? now : null,
          source: input.source ?? null,
          ...timestamps,
        });
        if (!row) {
          return tooManyDrafts();
        }
        return NextResponse.json(
          await serializeOne(row, { includeConfig: true }),
          { status: 201 },
        );
      } catch (error) {
        // Lost a race against another request creating the same slug.
        if (isUniqueViolation(error, "unique_draft_user_slug")) {
          const code = await findDraftCodeForSlug(user.id, input.slug);
          if (code) {
            return draftExists(code);
          }
        }
        throw error;
      }
    }

    const theme = await db.query.themes.findFirst({
      where: and(
        eq(themes.authorId, user.id),
        eq(themes.slug, input.themeSlug),
      ),
      columns: { id: true },
      with: {
        versions: {
          columns: {
            version: true,
            configContent: true,
            dependencies: true,
            minStarshipVersion: true,
          },
        },
      },
    });
    if (!theme) {
      return apiError(
        404,
        `You have no published theme "${input.themeSlug}"`,
        "theme_not_found",
      );
    }

    const existing = await findVersionDraftCode(user.id, theme.id);
    if (existing) {
      return draftExists(existing);
    }

    const latest = pickLatestVersion(theme.versions);
    let config: string | null = latest?.configContent ?? null;
    let configSource: string | null = latest ? "latest" : null;
    if (input.config) {
      config = input.config;
      configSource = via;
    }

    let version: string | null = latest
      ? calculateNextVersion(latest.version, "minor")
      : "1.0";
    if (input.version !== undefined) {
      version = input.version;
    }

    let minStarshipVersion = latest?.minStarshipVersion ?? null;
    if (input.minStarshipVersion !== undefined) {
      minStarshipVersion = input.minStarshipVersion;
    }

    try {
      const row = await insertDraftWithinLimit({
        userId: user.id,
        kind: "version",
        themeId: theme.id,
        version,
        versionNotes: input.versionNotes ?? null,
        dependencies: input.dependencies ?? latest?.dependencies ?? [],
        minStarshipVersion,
        config,
        configSource,
        configUpdatedAt: input.config ? now : null,
        source: input.source ?? null,
        ...timestamps,
      });
      if (!row) {
        return tooManyDrafts();
      }
      return NextResponse.json(
        await serializeOne(row, { includeConfig: true }),
        { status: 201 },
      );
    } catch (error) {
      if (isUniqueViolation(error, "unique_draft_user_theme")) {
        const code = await findVersionDraftCode(user.id, theme.id);
        if (code) {
          return draftExists(code);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("Draft create error:", error);
    return apiError(500, "Internal server error");
  }
}
