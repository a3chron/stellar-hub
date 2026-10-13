import { and, count, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { parse as parseToml } from "smol-toml";
import { z } from "zod";
import { apiError, isPlainObject, isUniqueViolation } from "@/lib/api-error";
import { APP_URL } from "@/lib/app-url";
import { randomCode } from "@/lib/cli-auth";
import { db } from "@/lib/db";
import { colorSchemes, themeDrafts, themes } from "@/lib/db/schema";
import type { ThemeDraft, ThemeVersion } from "@/lib/db/types";
import {
  CONFIG_MAX_LENGTH,
  type ConfigSource,
  DEPENDENCY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  DRAFT_CODE_PATTERN,
  DRAFT_TTL_MS,
  type Draft,
  type DraftKind,
  type DraftMissingField,
  type DraftStatus,
  GROUP_MAX_LENGTH,
  MAX_DEPENDENCIES,
  MAX_LIVE_DRAFTS,
  MIN_STARSHIP_VERSION_PATTERN,
  NAME_MAX_LENGTH,
  SLUG_PATTERN,
  SOURCE_MAX_LENGTH,
  VERSION_NOTES_MAX_LENGTH,
} from "@/lib/draft-shared";
import { isValidScreenshotFilename } from "@/lib/file-validation";
import { supabaseAdmin } from "@/lib/supabase";
import { isSingleLineSafe, SINGLE_LINE_MESSAGE } from "@/lib/text-rules";
import { pickLatestVersion, VERSION_PATTERN } from "@/lib/versions";

// Server-side draft helpers: validation, serialization to the API's `Draft`
// shape, expiry and screenshot cleanup. The routes in app/api/drafts/** and
// the /upload/[code] page are the only callers.

export const SCREENSHOT_BUCKET = "stellar";

export function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + DRAFT_TTL_MS);
}

export function screenshotPublicUrl(path: string): string {
  return supabaseAdmin.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

/**
 * Best-effort removal of draft screenshot objects. Never throws: by the time
 * this runs the draft rows are already gone, and an orphaned file is
 * recoverable while a failed request after a committed delete is not.
 */
export async function removeScreenshotObjects(
  paths: Array<string | null | undefined>,
): Promise<void> {
  // Paths are only ever written by the server, but a shape check keeps a bad
  // row from turning into a delete of something else in the bucket.
  const valid = paths.filter(
    (path): path is string => !!path && isValidScreenshotFilename(path),
  );
  if (valid.length === 0) {
    return;
  }

  try {
    const { error } = await supabaseAdmin.storage
      .from(SCREENSHOT_BUCKET)
      .remove(valid);
    if (error) {
      console.error("Failed to delete draft screenshots:", error);
    }
  } catch (error) {
    console.error("Failed to delete draft screenshots:", error);
  }
}

/**
 * Deletes the user's expired drafts and their screenshots. Runs at the start
 * of every draft read or write, so an expired draft is never served and never
 * blocks a slug or counts towards the limit.
 */
export async function purgeExpiredDrafts(userId: string): Promise<void> {
  const expired = await db
    .delete(themeDrafts)
    .where(
      and(
        eq(themeDrafts.userId, userId),
        lte(themeDrafts.expiresAt, new Date()),
      ),
    )
    .returning({ screenshotPath: themeDrafts.screenshotPath });

  await removeScreenshotObjects(expired.map((row) => row.screenshotPath));
}

/**
 * Deletes up to `limit` expired drafts of any user, with their screenshots.
 * The per-user purge only runs when that user comes back; this keeps the
 * documented 7 days true for everyone else. Opportunistic (there is no
 * cron), so it never throws - callers run it after their response.
 */
export async function purgeExpiredDraftsGlobally(limit = 50): Promise<void> {
  try {
    const expired = await db
      .delete(themeDrafts)
      .where(
        inArray(
          themeDrafts.id,
          db
            .select({ id: themeDrafts.id })
            .from(themeDrafts)
            .where(lte(themeDrafts.expiresAt, new Date()))
            .limit(limit),
        ),
      )
      .returning({ screenshotPath: themeDrafts.screenshotPath });

    await removeScreenshotObjects(expired.map((row) => row.screenshotPath));
  } catch (error) {
    console.error("Global draft cleanup failed:", error);
  }
}

/** Codes are stored uppercase and looked up case-insensitively. */
export function normalizeDraftCode(code: string): string | null {
  const normalized = code.toUpperCase();
  return DRAFT_CODE_PATTERN.test(normalized) ? normalized : null;
}

/** The user's live draft with this code - other users' drafts don't exist. */
export async function findLiveDraft(
  userId: string,
  code: string,
): Promise<ThemeDraft | undefined> {
  const normalized = normalizeDraftCode(code);
  if (!normalized) {
    return undefined;
  }

  return db.query.themeDrafts.findFirst({
    where: and(
      eq(themeDrafts.code, normalized),
      eq(themeDrafts.userId, userId),
      gt(themeDrafts.expiresAt, new Date()),
    ),
  });
}

export function draftNotFound() {
  return apiError(
    404,
    "Draft not found - it may have expired, been published or been deleted",
    "draft_not_found",
  );
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type NewDraft = Omit<typeof themeDrafts.$inferInsert, "code">;

/**
 * Inserts a draft under a fresh code. A collision on the code is retried
 * rather than checked up front - with 32^6 codes it is rare enough that the
 * unique index is the cheaper guard. Each attempt runs in its own savepoint,
 * so a collision inside a caller's transaction doesn't abort all of it.
 */
async function insertDraft(
  values: NewDraft,
  executor: DbTransaction,
): Promise<ThemeDraft> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await executor.transaction(async (savepoint) => {
        const [row] = await savepoint
          .insert(themeDrafts)
          .values({ ...values, code: randomCode(6) })
          .returning();
        return row;
      });
    } catch (error) {
      if (attempt < 5 && isUniqueViolation(error, "theme_drafts_code_unique")) {
        continue;
      }
      throw error;
    }
  }
}

/**
 * Inserts a draft unless the user already has MAX_LIVE_DRAFTS live ones, and
 * returns null in that case. Counting and inserting happen under a per-user
 * transaction-scoped advisory lock - it also works through Supabase's
 * transaction pooler, unlike a session lock - so two concurrent creates can't
 * both pass the count.
 */
export async function insertDraftWithinLimit(
  values: NewDraft,
): Promise<ThemeDraft | null> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${values.userId}))`,
    );

    const [{ live }] = await tx
      .select({ live: count() })
      .from(themeDrafts)
      .where(
        and(
          eq(themeDrafts.userId, values.userId),
          gt(themeDrafts.expiresAt, new Date()),
        ),
      );
    if (live >= MAX_LIVE_DRAFTS) {
      return null;
    }

    return insertDraft(values, tx);
  });
}

/** The code of the user's live new-theme draft holding `slug`, if any. */
export async function findDraftCodeForSlug(
  userId: string,
  slug: string,
  exceptCode?: string | null,
): Promise<string | undefined> {
  const rows = await db
    .select({ code: themeDrafts.code })
    .from(themeDrafts)
    .where(
      and(
        eq(themeDrafts.userId, userId),
        eq(themeDrafts.kind, "theme"),
        eq(themeDrafts.slug, slug),
        gt(themeDrafts.expiresAt, new Date()),
      ),
    )
    .limit(2);

  return rows.find((row) => row.code !== exceptCode)?.code;
}

/** The code of the user's live version draft for `themeId`, if any. */
export async function findVersionDraftCode(
  userId: string,
  themeId: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ code: themeDrafts.code })
    .from(themeDrafts)
    .where(
      and(
        eq(themeDrafts.userId, userId),
        eq(themeDrafts.kind, "version"),
        eq(themeDrafts.themeId, themeId),
        gt(themeDrafts.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return row?.code;
}

export function draftExists(code: string) {
  return apiError(
    409,
    `You already have a draft for this (${code}) - continue that one instead`,
    "draft_exists",
    { details: { code } },
  );
}

export function duplicateSlug() {
  return apiError(
    409,
    "You already published a theme with this slug - publish a new version of it instead",
    "duplicate_slug",
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** The parse error, or null when the config is valid TOML. */
export function tomlError(config: string): string | null {
  try {
    parseToml(config);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid TOML";
  }
}

export function invalidConfig(message: string) {
  return apiError(400, message, "invalid_config");
}

function emptyToNull(value: unknown) {
  return value === "" ? null : value;
}

// Single-line text (names, groups, dependencies) follows the shared rule in
// lib/text-rules.ts: no control characters, no invisible bidi marks.

// Multi-line text (description, version notes) keeps newlines and tabs and
// nothing else from the control range.
const MULTI_LINE_FORBIDDEN = /[^\P{Cc}\n\t]/u;
const MULTI_LINE_MESSAGE =
  "must not contain control characters other than line breaks and tabs";

function isMultiLineSafe(value: string) {
  return !MULTI_LINE_FORBIDDEN.test(value);
}

/** "" -> null, and Windows line endings -> "\n" before anything is checked. */
function multiLineOrNull(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.replace(/\r\n/g, "\n");
  return normalized === "" ? null : normalized;
}

function trimmedOrNull(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// `null` clears the list, and blank entries are dropped rather than refused -
// the wizard's textarea and `--dep ""` both produce them naturally.
function normalizeDependencies(value: unknown) {
  if (value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return value;
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
    .filter((entry) => entry !== "");
}

// "author/name@ver" or a bare filename. An absolute (or otherwise path-like)
// value is cut down to its filename instead of being refused: it is purely
// informational, and storing someone's home directory layout is not.
const SOURCE_IDENTIFIER = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+(@[0-9.]+)?$/;

function normalizeSource(value: unknown) {
  const trimmed = trimmedOrNull(value);
  if (typeof trimmed !== "string") {
    return trimmed;
  }
  const cleaned = trimmed.replace(/\p{Cc}/gu, "");
  if (!/[/\\]/.test(cleaned) || SOURCE_IDENTIFIER.test(cleaned)) {
    return cleaned || null;
  }
  return cleaned.split(/[/\\]/).pop() || null;
}

const nameField = z.preprocess(
  trimmedOrNull,
  z
    .string()
    .max(NAME_MAX_LENGTH, `must be ${NAME_MAX_LENGTH} characters or less`)
    .refine(isSingleLineSafe, SINGLE_LINE_MESSAGE)
    .nullable(),
);

const slugField = z
  .string({
    required_error: "is required",
    invalid_type_error: "is required for a new theme",
  })
  .regex(SLUG_PATTERN, "must be 1-50 lowercase letters, digits or hyphens");

const descriptionField = z.preprocess(
  multiLineOrNull,
  z
    .string()
    .max(
      DESCRIPTION_MAX_LENGTH,
      `must be ${DESCRIPTION_MAX_LENGTH} characters or less`,
    )
    .refine(isMultiLineSafe, MULTI_LINE_MESSAGE)
    .nullable(),
);

const groupField = z.preprocess(
  trimmedOrNull,
  z
    .string()
    .max(GROUP_MAX_LENGTH, `must be ${GROUP_MAX_LENGTH} characters or less`)
    .refine(isSingleLineSafe, SINGLE_LINE_MESSAGE)
    .nullable(),
);

const colorModeField = z.preprocess(
  emptyToNull,
  z
    .enum(["dark", "light", "both"], {
      errorMap: () => ({ message: "must be dark, light or both" }),
    })
    .nullable(),
);

const colorSchemeIdField = z.preprocess(
  emptyToNull,
  z.string().uuid("is not a known color scheme").nullable(),
);

const versionField = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(VERSION_PATTERN, "must look like 1.0 (two numbers, no leading v)")
    .nullable(),
);

const versionNotesField = z.preprocess(
  multiLineOrNull,
  z
    .string()
    .max(
      VERSION_NOTES_MAX_LENGTH,
      `must be ${VERSION_NOTES_MAX_LENGTH} characters or less`,
    )
    .refine(isMultiLineSafe, MULTI_LINE_MESSAGE)
    .nullable(),
);

const minStarshipVersionField = z.preprocess(
  trimmedOrNull,
  z
    .string()
    .regex(MIN_STARSHIP_VERSION_PATTERN, "must look like 1.24.0")
    .nullable(),
);

const dependenciesField = z.preprocess(
  normalizeDependencies,
  z
    .array(
      z
        .string()
        .max(
          DEPENDENCY_MAX_LENGTH,
          `each must be ${DEPENDENCY_MAX_LENGTH} characters or less`,
        )
        .refine(isSingleLineSafe, `each ${SINGLE_LINE_MESSAGE}`),
    )
    .max(MAX_DEPENDENCIES, `at most ${MAX_DEPENDENCIES} are allowed`),
);

const configField = z.preprocess(
  emptyToNull,
  z
    .string()
    .max(CONFIG_MAX_LENGTH, `must be ${CONFIG_MAX_LENGTH} characters or less`)
    .nullable(),
);

const sourceField = z.preprocess(
  normalizeSource,
  z
    .string()
    .max(SOURCE_MAX_LENGTH, `must be ${SOURCE_MAX_LENGTH} characters or less`)
    .nullable(),
);

const createThemeDraftSchema = z.object({
  kind: z.literal("theme"),
  slug: slugField,
  name: nameField.optional(),
  description: descriptionField.optional(),
  group: groupField.optional(),
  colorMode: colorModeField.optional(),
  colorSchemeId: colorSchemeIdField.optional(),
  dependencies: dependenciesField.optional(),
  minStarshipVersion: minStarshipVersionField.optional(),
  version: versionField.optional(),
  versionNotes: versionNotesField.optional(),
  config: configField.optional(),
  source: sourceField.optional(),
});

const createVersionDraftSchema = z.object({
  kind: z.literal("version"),
  themeSlug: slugField,
  version: versionField.optional(),
  versionNotes: versionNotesField.optional(),
  dependencies: dependenciesField.optional(),
  minStarshipVersion: minStarshipVersionField.optional(),
  config: configField.optional(),
  source: sourceField.optional(),
});

export const createDraftSchema = z.discriminatedUnion(
  "kind",
  [createThemeDraftSchema, createVersionDraftSchema],
  {
    errorMap: () => ({ message: 'must be "theme" or "version"' }),
  },
);

export const patchDraftSchema = z.object({
  name: nameField.optional(),
  slug: slugField.optional(),
  description: descriptionField.optional(),
  group: groupField.optional(),
  colorMode: colorModeField.optional(),
  colorSchemeId: colorSchemeIdField.optional(),
  dependencies: dependenciesField.optional(),
  minStarshipVersion: minStarshipVersionField.optional(),
  version: versionField.optional(),
  versionNotes: versionNotesField.optional(),
  config: configField.optional(),
  source: sourceField.optional(),
  // Immutable, but accepted when unchanged so a client can echo a draft back.
  kind: z.unknown().optional(),
  themeSlug: z.unknown().optional(),
});

export type CreateDraftInput = z.infer<typeof createDraftSchema>;
export type PatchDraftInput = z.infer<typeof patchDraftSchema>;

// Fields only a new theme has. A version draft publishes into an existing
// theme, whose details are edited in settings instead.
export const THEME_ONLY_FIELDS = [
  "name",
  "slug",
  "description",
  "group",
  "colorMode",
  "colorSchemeId",
] as const;

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

type LatestVersion = Pick<
  ThemeVersion,
  "version" | "configContent" | "dependencies" | "minStarshipVersion"
>;

export interface DraftThemeContext {
  slug: string;
  name: string;
  latest: LatestVersion | undefined;
}

/** Slug, name and numerically latest version of the themes behind drafts. */
export async function loadThemeContexts(
  themeIds: string[],
): Promise<Map<string, DraftThemeContext>> {
  const contexts = new Map<string, DraftThemeContext>();
  if (themeIds.length === 0) {
    return contexts;
  }

  const rows = await db.query.themes.findMany({
    where: inArray(themes.id, [...new Set(themeIds)]),
    columns: { id: true, slug: true, name: true },
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

  for (const row of rows) {
    contexts.set(row.id, {
      slug: row.slug,
      name: row.name,
      latest: pickLatestVersion(row.versions),
    });
  }
  return contexts;
}

/** A config that is only whitespace counts as no config at all. */
function hasConfig(row: Pick<ThemeDraft, "config">): boolean {
  return !!row.config && row.config.trim() !== "";
}

export function draftMissing(row: ThemeDraft): DraftMissingField[] {
  const missing: DraftMissingField[] = [];

  if (row.kind === "version") {
    if (!row.version) {
      missing.push("version");
    }
    // A version draft starts with the latest config and can't clear it, but
    // it can still be set to whitespace - which would publish an empty theme.
    if (!hasConfig(row)) {
      missing.push("config");
    }
    return missing;
  }

  if (!row.name) {
    missing.push("name");
  }
  if (!hasConfig(row)) {
    missing.push("config");
  }
  if (!row.screenshotPath) {
    missing.push("screenshot");
  }
  return missing;
}

function draftStatus(
  row: ThemeDraft,
  missing: DraftMissingField[],
): DraftStatus {
  // Only an actually missing config is waited for. A version draft still on
  // the latest version's config is a complete draft like any other.
  if (!hasConfig(row)) {
    return "waiting_for_config";
  }
  if (missing.length > 0) {
    return "incomplete";
  }
  return "ready";
}

function normalizeConfigForCompare(config: string): string {
  return config.replace(/\r\n/g, "\n").trim();
}

/** Whether a version draft would publish exactly what the latest one has. */
export function isUnchangedFromLatest(
  row: Pick<ThemeDraft, "config" | "dependencies" | "minStarshipVersion">,
  latest: LatestVersion | undefined,
): boolean {
  if (!latest || row.config === null) {
    return false;
  }

  const latestDependencies = latest.dependencies ?? [];
  const sameDependencies =
    row.dependencies.length === latestDependencies.length &&
    row.dependencies.every(
      (dependency, i) => dependency === latestDependencies[i],
    );

  return (
    normalizeConfigForCompare(row.config) ===
      normalizeConfigForCompare(latest.configContent) &&
    sameDependencies &&
    (row.minStarshipVersion ?? null) === (latest.minStarshipVersion ?? null)
  );
}

export function serializeDraft(
  row: ThemeDraft,
  context: DraftThemeContext | undefined,
  { includeConfig }: { includeConfig: boolean },
): Draft {
  const missing = draftMissing(row);
  const isVersion = row.kind === "version";

  const draft: Draft = {
    code: row.code,
    kind: row.kind as DraftKind,
    status: draftStatus(row, missing),
    url: `${APP_URL}/upload/${row.code}`,
    theme:
      isVersion && context
        ? {
            slug: context.slug,
            name: context.name,
            latestVersion: context.latest?.version ?? null,
          }
        : null,
    name: row.name,
    slug: row.slug,
    description: row.description,
    group: row.group,
    colorMode: row.colorMode,
    colorSchemeId: row.colorSchemeId,
    dependencies: row.dependencies,
    minStarshipVersion: row.minStarshipVersion,
    version: row.version,
    versionNotes: row.versionNotes,
    hasConfig: hasConfig(row),
    configSource: row.configSource as ConfigSource | null,
    configUpdatedAt: row.configUpdatedAt?.toISOString() ?? null,
    unchangedFromLatest:
      isVersion && isUnchangedFromLatest(row, context?.latest),
    screenshotUrl: row.screenshotPath
      ? screenshotPublicUrl(row.screenshotPath)
      : null,
    source: row.source,
    missing,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };

  if (includeConfig) {
    draft.config = row.config;
  }
  return draft;
}

export async function serializeDrafts(
  rows: ThemeDraft[],
  options: { includeConfig: boolean },
): Promise<Draft[]> {
  const contexts = await loadThemeContexts(
    rows.flatMap((row) => (row.themeId ? [row.themeId] : [])),
  );
  return rows.map((row) =>
    serializeDraft(
      row,
      row.themeId ? contexts.get(row.themeId) : undefined,
      options,
    ),
  );
}

export async function serializeOne(
  row: ThemeDraft,
  options: { includeConfig: boolean },
): Promise<Draft> {
  const [draft] = await serializeDrafts([row], options);
  return draft;
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/** The JSON object body, or null when it is missing or not an object. */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return isPlainObject(body) ? body : null;
}

export function notAnObject() {
  return apiError(
    400,
    "The request body must be a JSON object",
    "validation_failed",
    { details: {} },
  );
}

export function fieldError(field: string, message: string) {
  return apiError(400, `${field}: ${message}`, "validation_failed", {
    details: { [field]: [message] },
  });
}

export async function colorSchemeExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: colorSchemes.id })
    .from(colorSchemes)
    .where(eq(colorSchemes.id, id))
    .limit(1);
  return !!row;
}
