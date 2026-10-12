import { and, eq, gt } from "drizzle-orm";
import { apiError, isUniqueViolation } from "@/lib/api-error";
import { APP_URL } from "@/lib/app-url";
import { db } from "@/lib/db";
import { themeDrafts, themes, themeVersions } from "@/lib/db/schema";
import type { ThemeDraft } from "@/lib/db/types";
import {
  draftMissing,
  normalizeDraftCode,
  patchDraftSchema,
  screenshotPublicUrl,
  tomlError,
} from "@/lib/drafts";
import type { RequestUser } from "@/lib/request-auth";
import { compareVersions, pickLatestVersion } from "@/lib/versions";

// The one way anything gets published - the wizard's Publish button and
// `stellar publish --publish` both end up here.

export interface PublishResult {
  author: string;
  slug: string;
  version: string;
  url: string;
}

/** A publish refusal, carrying the API error it maps to. */
export class PublishError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
    readonly extra?: { details?: unknown; missing?: string[] },
  ) {
    super(message);
  }

  toResponse() {
    return apiError(this.status, this.message, this.code, this.extra);
  }
}

function notFound() {
  return new PublishError(
    404,
    "Draft not found - it may have expired, been published or been deleted",
    "draft_not_found",
  );
}

function duplicateSlug() {
  return new PublishError(
    409,
    "You already published a theme with this slug - publish a new version of it instead",
    "duplicate_slug",
  );
}

function versionExists(version: string) {
  return new PublishError(
    409,
    `Version ${version} already exists - pick a newer one`,
    "version_exists",
  );
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Stored values were validated when they were written, but the rules may have
 * tightened since - re-check them with the same schema the PATCH uses before
 * anything becomes public.
 */
function revalidate(draft: ThemeDraft) {
  const parsed = patchDraftSchema.safeParse({
    name: draft.name,
    description: draft.description,
    group: draft.group,
    colorMode: draft.colorMode,
    colorSchemeId: draft.colorSchemeId,
    dependencies: draft.dependencies,
    minStarshipVersion: draft.minStarshipVersion,
    version: draft.version,
    versionNotes: draft.versionNotes,
    config: draft.config,
    source: draft.source,
    ...(draft.kind === "theme" ? { slug: draft.slug } : {}),
  });

  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const [field, messages] = Object.entries(fieldErrors)[0] ?? [];
    throw new PublishError(
      400,
      field ? `${field}: ${messages?.[0]}` : "Invalid draft",
      "validation_failed",
      { details: fieldErrors },
    );
  }

  if (draft.config) {
    const problem = tomlError(draft.config);
    if (problem) {
      throw new PublishError(400, problem, "invalid_config");
    }
  }
}

async function publishTheme(
  tx: Transaction,
  owner: RequestUser,
  draft: ThemeDraft,
): Promise<PublishResult> {
  // Guaranteed by draftMissing() and the draft schema; narrowed here.
  const { slug, name, config, screenshotPath } = draft;
  if (!slug || !name || !config || !screenshotPath) {
    throw new PublishError(
      400,
      "This draft is incomplete",
      "draft_incomplete",
      { missing: draftMissing(draft) },
    );
  }
  const version = draft.version ?? "1.0";

  const existing = await tx
    .select({ id: themes.id })
    .from(themes)
    .where(and(eq(themes.authorId, owner.id), eq(themes.slug, slug)))
    .limit(1);
  if (existing.length > 0) {
    throw duplicateSlug();
  }

  const [theme] = await tx
    .insert(themes)
    .values({
      authorId: owner.id,
      slug,
      name,
      description: draft.description,
      // Uploaded straight to its final name, so nothing has to move.
      screenshotUrl: screenshotPublicUrl(screenshotPath),
      colorSchemeId: draft.colorSchemeId,
      colorMode: draft.colorMode ?? "dark",
      group: draft.group,
    })
    .returning({ id: themes.id });

  await tx.insert(themeVersions).values({
    themeId: theme.id,
    version,
    configContent: config,
    versionNotes: draft.versionNotes,
    dependencies: draft.dependencies.length > 0 ? draft.dependencies : null,
    minStarshipVersion: draft.minStarshipVersion,
  });

  return {
    author: owner.username,
    slug,
    version,
    url: `${APP_URL}/${owner.username}/${slug}`,
  };
}

async function publishVersion(
  tx: Transaction,
  owner: RequestUser,
  draft: ThemeDraft,
): Promise<PublishResult> {
  const { themeId, version, config } = draft;
  if (!themeId || !version || !config) {
    throw new PublishError(
      400,
      "This draft is incomplete",
      "draft_incomplete",
      { missing: draftMissing(draft) },
    );
  }

  // Locked, so two publishes of the same theme are checked one after the
  // other instead of both passing the "is it newer" test against the same
  // latest version.
  const [theme] = await tx
    .select({ id: themes.id, slug: themes.slug })
    .from(themes)
    .where(and(eq(themes.id, themeId), eq(themes.authorId, owner.id)))
    .for("update");
  if (!theme) {
    throw notFound();
  }

  const versions = await tx
    .select({ version: themeVersions.version })
    .from(themeVersions)
    .where(eq(themeVersions.themeId, theme.id));

  if (versions.some((existing) => existing.version === version)) {
    throw versionExists(version);
  }

  const latest = pickLatestVersion(versions);
  if (latest && compareVersions(version, latest.version) <= 0) {
    throw new PublishError(
      400,
      `Version ${version} isn't newer than the latest version ${latest.version}`,
      "version_not_newer",
      { details: { latest: latest.version } },
    );
  }

  await tx.insert(themeVersions).values({
    themeId: theme.id,
    version,
    configContent: config,
    versionNotes: draft.versionNotes,
    dependencies: draft.dependencies.length > 0 ? draft.dependencies : null,
    minStarshipVersion: draft.minStarshipVersion,
  });

  await tx
    .update(themes)
    .set({ updatedAt: new Date() })
    .where(eq(themes.id, theme.id));

  return {
    author: owner.username,
    slug: theme.slug,
    version,
    url: `${APP_URL}/${owner.username}/${theme.slug}`,
  };
}

/**
 * Publishes a draft in a single transaction that starts by deleting it. Any
 * refusal or failure after that rolls the delete back, so a draft that can't
 * be published is left exactly as it was - and one that was published is gone
 * in the same commit, so it can never be published twice.
 *
 * Throws PublishError for every expected refusal.
 */
export async function publishDraft(
  owner: RequestUser,
  code: string,
): Promise<PublishResult> {
  const normalized = normalizeDraftCode(code);
  if (!normalized) {
    throw notFound();
  }

  try {
    return await db.transaction(async (tx) => {
      const [draft] = await tx
        .delete(themeDrafts)
        .where(
          and(
            eq(themeDrafts.code, normalized),
            eq(themeDrafts.userId, owner.id),
            gt(themeDrafts.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!draft) {
        throw notFound();
      }

      const missing = draftMissing(draft);
      if (missing.length > 0) {
        throw new PublishError(
          400,
          `This draft still needs: ${missing.join(", ")}`,
          "draft_incomplete",
          { missing },
        );
      }

      revalidate(draft);

      if (draft.kind === "theme") {
        return publishTheme(tx, owner, draft);
      }
      return publishVersion(tx, owner, draft);
    });
  } catch (error) {
    if (error instanceof PublishError) {
      throw error;
    }
    // The unique indexes settle races the checks above can't see.
    if (isUniqueViolation(error, "unique_author_slug")) {
      throw duplicateSlug();
    }
    if (isUniqueViolation(error, "unique_theme_version")) {
      throw new PublishError(
        409,
        "That version already exists - pick a newer one",
        "version_exists",
      );
    }
    throw error;
  }
}
