import { and, eq, gt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { apiError, isUniqueViolation, validationFailed } from "@/lib/api-error";
import { db } from "@/lib/db";
import { themeDrafts } from "@/lib/db/schema";
import {
  colorSchemeExists,
  draftExists,
  draftNotFound,
  duplicateSlug,
  expiryFrom,
  fieldError,
  findDraftCodeForSlug,
  findLiveDraft,
  invalidConfig,
  loadThemeContexts,
  normalizeDraftCode,
  notAnObject,
  patchDraftSchema,
  purgeExpiredDrafts,
  readJsonObject,
  removeScreenshotObjects,
  serializeOne,
  THEME_ONLY_FIELDS,
  tomlError,
} from "@/lib/drafts";
import { getDraftUser } from "@/lib/request-auth";
import { themeSlugTaken } from "@/lib/theme-exists";

type RouteParams = { params: Promise<{ code: string }> };

/**
 * GET /api/drafts/[code]
 *
 * One of the caller's drafts, with its config unless `?config=0` (the
 * wizard's "From CLI" poll only needs to know whether the config changed).
 * Someone else's draft is a 404, same as an expired one.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getDraftUser(request);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;
    const { code } = await params;

    await purgeExpiredDrafts(user.id);

    const row = await findLiveDraft(user.id, code);
    if (!row) {
      return draftNotFound();
    }

    const includeConfig = request.nextUrl.searchParams.get("config") !== "0";
    return NextResponse.json(await serializeOne(row, { includeConfig }));
  } catch (error) {
    console.error("Draft read error:", error);
    return apiError(500, "Internal server error");
  }
}

/**
 * PATCH /api/drafts/[code]
 *
 * Omitted fields stay as they are, `null` clears one, and `dependencies`
 * replaces the whole list. The config's source and timestamp - what the
 * wizard watches while it waits on `stellar publish` - move on every config
 * write from the CLI, even an identical one (an explicit push should always
 * show up), and on web writes only when the config actually changed.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getDraftUser(request);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user, via } = authResult;
    const { code } = await params;

    await purgeExpiredDrafts(user.id);

    const row = await findLiveDraft(user.id, code);
    if (!row) {
      return draftNotFound();
    }

    const body = await readJsonObject(request);
    if (!body) {
      return notAnObject();
    }
    const parsed = patchDraftSchema.safeParse(body);
    if (!parsed.success) {
      return validationFailed(parsed.error);
    }
    const input = parsed.data;

    if (input.kind !== undefined && input.kind !== row.kind) {
      return fieldError("kind", "can't be changed");
    }

    if (row.kind === "version") {
      if (input.themeSlug !== undefined) {
        const [context] = (
          await loadThemeContexts(row.themeId ? [row.themeId] : [])
        ).values();
        if (input.themeSlug !== context?.slug) {
          return fieldError("themeSlug", "can't be changed");
        }
      }
      for (const field of THEME_ONLY_FIELDS) {
        if (input[field] !== undefined && input[field] !== null) {
          return fieldError(
            field,
            "only applies to a new theme - edit the theme's details in settings instead",
          );
        }
      }
      if (input.config === null) {
        return fieldError(
          "config",
          "can't be cleared on a new version - it starts from the latest one",
        );
      }
    } else if (input.themeSlug !== undefined && input.themeSlug !== null) {
      return fieldError("themeSlug", "only applies to a new version");
    }

    if (input.config) {
      const problem = tomlError(input.config);
      if (problem) {
        return invalidConfig(problem);
      }
    }

    if (
      row.kind === "theme" &&
      input.slug !== undefined &&
      input.slug !== row.slug
    ) {
      if (await themeSlugTaken(user.id, input.slug)) {
        return duplicateSlug();
      }
      const other = await findDraftCodeForSlug(user.id, input.slug, row.code);
      if (other) {
        return draftExists(other);
      }
    }

    if (
      input.colorSchemeId &&
      !(await colorSchemeExists(input.colorSchemeId))
    ) {
      return fieldError("colorSchemeId", "is not a known color scheme");
    }

    const now = new Date();
    const updates: Partial<typeof themeDrafts.$inferInsert> = {
      updatedAt: now,
      expiresAt: expiryFrom(now),
    };

    if (row.kind === "theme") {
      if (input.name !== undefined) {
        updates.name = input.name;
      }
      if (input.slug !== undefined) {
        updates.slug = input.slug;
      }
      if (input.description !== undefined) {
        updates.description = input.description;
      }
      if (input.group !== undefined) {
        updates.group = input.group;
      }
      if (input.colorMode !== undefined) {
        updates.colorMode = input.colorMode;
      }
      if (input.colorSchemeId !== undefined) {
        updates.colorSchemeId = input.colorSchemeId;
      }
    }
    if (input.dependencies !== undefined) {
      updates.dependencies = input.dependencies;
    }
    if (input.minStarshipVersion !== undefined) {
      updates.minStarshipVersion = input.minStarshipVersion;
    }
    if (input.version !== undefined) {
      // A new theme always has a version, so clearing it means the default.
      updates.version =
        input.version === null && row.kind === "theme" ? "1.0" : input.version;
    }
    if (input.versionNotes !== undefined) {
      updates.versionNotes = input.versionNotes;
    }
    if (input.source !== undefined) {
      updates.source = input.source;
    }
    const pushedFromCli = via === "cli" && input.config !== null;
    if (
      input.config !== undefined &&
      (input.config !== row.config || pushedFromCli)
    ) {
      updates.config = input.config;
      updates.configSource = input.config === null ? null : via;
      updates.configUpdatedAt = now;
    }

    let updated: (typeof themeDrafts.$inferSelect)[];
    try {
      updated = await db
        .update(themeDrafts)
        .set(updates)
        .where(and(eq(themeDrafts.id, row.id), gt(themeDrafts.expiresAt, now)))
        .returning();
    } catch (error) {
      if (isUniqueViolation(error, "unique_draft_user_slug") && input.slug) {
        const other = await findDraftCodeForSlug(user.id, input.slug, row.code);
        if (other) {
          return draftExists(other);
        }
      }
      throw error;
    }

    // Published or deleted between the read above and this write.
    if (updated.length === 0) {
      return draftNotFound();
    }

    return NextResponse.json(
      await serializeOne(updated[0], { includeConfig: true }),
    );
  } catch (error) {
    console.error("Draft update error:", error);
    return apiError(500, "Internal server error");
  }
}

/**
 * DELETE /api/drafts/[code]
 *
 * Discards a draft and its screenshot.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getDraftUser(request);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;
    const { code } = await params;

    await purgeExpiredDrafts(user.id);

    const normalized = normalizeDraftCode(code);
    if (!normalized) {
      return draftNotFound();
    }

    const deleted = await db
      .delete(themeDrafts)
      .where(
        and(eq(themeDrafts.code, normalized), eq(themeDrafts.userId, user.id)),
      )
      .returning({ screenshotPath: themeDrafts.screenshotPath });

    if (deleted.length === 0) {
      return draftNotFound();
    }

    await removeScreenshotObjects(deleted.map((row) => row.screenshotPath));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Draft delete error:", error);
    return apiError(500, "Internal server error");
  }
}
