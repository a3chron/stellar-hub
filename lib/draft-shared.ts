// The draft API's wire shape and field rules, shared by the server
// (lib/drafts.ts) and the upload wizard. Free of server imports so client
// components can use it.
import type { ThemeDraft } from "@/lib/db/types";

export type DraftKind = "theme" | "version";
export type DraftStatus = "waiting_for_config" | "incomplete" | "ready";
export type ConfigSource = "cli" | "web" | "latest";
export type DraftMissingField = "name" | "config" | "screenshot" | "version";

/** A draft as GET/POST/PATCH /api/drafts/** return it. */
export interface Draft {
  code: string;
  kind: DraftKind;
  status: DraftStatus;
  url: string;
  // Version drafts only: the theme the version is for.
  // highestVersion is the number a new version has to beat: the latest, or a
  // deleted version above it, since deleted numbers are never reused.
  theme: {
    slug: string;
    name: string;
    latestVersion: string | null;
    highestVersion: string | null;
  } | null;
  // Theme drafts only (slug is always set on them).
  name: string | null;
  slug: string | null;
  description: string | null;
  group: string | null;
  colorMode: ThemeDraft["colorMode"];
  colorSchemeId: string | null;
  dependencies: string[];
  minStarshipVersion: string | null;
  version: string | null;
  versionNotes: string | null;
  hasConfig: boolean;
  // Only in single-draft responses, and omitted there with ?config=0.
  config?: string | null;
  configSource: ConfigSource | null;
  configUpdatedAt: string | null;
  unchangedFromLatest: boolean;
  screenshotUrl: string | null;
  source: string | null;
  missing: DraftMissingField[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

/** What POST /api/drafts/[code]/publish answers. */
export interface PublishResult {
  author: string;
  slug: string;
  version: string;
  url: string;
}

/** The error body every CLI-facing route uses. */
export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
  missing?: string[];
}

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_LIVE_DRAFTS = 10;

export const NAME_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 500;
export const GROUP_MAX_LENGTH = 100;
export const VERSION_NOTES_MAX_LENGTH = 500;
export const MAX_DEPENDENCIES = 20;
export const DEPENDENCY_MAX_LENGTH = 100;
export const SOURCE_MAX_LENGTH = 200;
export const CONFIG_MAX_LENGTH = 100000;

export const SLUG_PATTERN = /^[a-z0-9-]{1,50}$/;
export const MIN_STARSHIP_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
export const DRAFT_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

/** One dependency per line in the wizard's textarea <-> the stored array. */
export function parseDependencies(text: string): string[] {
  return text
    .split("\n")
    .map((dependency) => dependency.trim())
    .filter((dependency) => dependency.length > 0);
}
