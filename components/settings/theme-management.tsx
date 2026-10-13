"use client";

import {
  CalendarClock,
  Download,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { LocalDate } from "@/components/local-time";
import type { ColorScheme, Theme as ThemeRow } from "@/lib/db/types";
import type { Draft } from "@/lib/draft-shared";
import { apiFetch, existingDraftCode, jsonRequest } from "@/lib/drafts-client";
import type { ThemeGroup } from "@/lib/theme-groups";
import { formatDownloads } from "@/lib/utils";
import { formatVersion, pickLatestVersion } from "@/lib/versions";
import EditMetadataForm from "../edit-metadata-form";
import SettingsSection, {
  buttonClass,
  ICON_DELETE_BUTTON,
} from "./settings-section";
import ThemeVersions, { type ListedVersion } from "./theme-versions";
import { useFocusAfterRemoval } from "./use-focus-after-removal";

type Theme = Pick<
  ThemeRow,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "screenshotUrl"
  | "downloads"
  | "colorSchemeId"
  | "colorMode"
  | "group"
  | "updatedAt"
> & { versions: ListedVersion[] };

/** "1 version", "4 versions". */
function versionCount(count: number): string {
  return count === 1 ? "1 version" : `${count} versions`;
}

/** "with its only version" / "with all 4 of its versions". */
function versionsPhrase(count: number): string {
  if (count === 1) {
    return "with its only version";
  }
  return `with all ${count} of its versions`;
}

interface ThemeManagementProps {
  author: string;
  themes: Theme[];
  colorSchemes: Pick<ColorScheme, "id" | "name">[];
  groups: ThemeGroup[];
}

export default function ThemeManagement({
  author,
  themes,
  colorSchemes,
  groups,
}: ThemeManagementProps) {
  const router = useRouter();
  const [editingMetadata, setEditingMetadata] = useState<string | null>(null);
  const [startingVersion, setStartingVersion] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<{
    slug: string;
    message: string;
    code?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<Theme | null>(null);
  const { headingRef, buttonRef, removing } = useFocusAfterRemoval(
    themes.map((theme) => theme.slug),
  );

  // A new version is put together as a draft in the upload wizard. An open
  // version draft for the theme (from an earlier visit, or from
  // `stellar publish`) is continued rather than duplicated.
  const startVersion = async (slug: string) => {
    setStartingVersion(slug);
    setVersionError(null);

    const result = await apiFetch<Draft>(
      "/api/drafts",
      jsonRequest("POST", { kind: "version", themeSlug: slug }),
    );
    const code = result.ok ? result.data.code : existingDraftCode(result.error);
    if (code) {
      router.push(`/upload/${code}`);
      return;
    }

    setStartingVersion(null);
    if (!result.ok) {
      setVersionError({
        slug,
        message: result.error.error,
        code: result.error.code,
      });
    }
  };

  // Resolves with the message to show in the dialog, or null once deleted.
  const deleteTheme = async (theme: Theme): Promise<string | null> => {
    try {
      const response = await fetch(`/api/${author}/${theme.slug}`, {
        method: "DELETE",
      });

      if (response.ok) {
        removing(theme.slug);
        setDeleting(null);
        router.refresh();
        return null;
      }

      const body = await response.json().catch(() => null);
      return body?.error ?? `Delete failed (${response.status})`;
    } catch {
      return "Could not reach the server - check your connection and try again.";
    }
  };

  if (themes.length === 0) {
    return (
      <SettingsSection id="themes" title="Themes" headingRef={headingRef}>
        <div className="rounded-lg border border-dashed border-ctp-surface1 px-4 py-10 text-center">
          <p className="mb-4 text-ctp-subtext0">
            You haven't uploaded any themes yet
          </p>
          <Link href="/upload" className={buttonClass("secondary")}>
            <Plus aria-hidden="true" className="size-4" />
            Upload your first theme
          </Link>
        </div>
      </SettingsSection>
    );
  }

  const editingTheme = themes.find((t) => t.slug === editingMetadata);

  return (
    <>
      <SettingsSection
        id="themes"
        title="Themes"
        count={themes.length}
        headingRef={headingRef}
        description="Edit how a theme is shown, publish a new version, or clean up old ones."
        action={
          <Link href="/upload" className={buttonClass("secondary", "sm")}>
            <Plus aria-hidden="true" className="size-4" />
            Upload theme
          </Link>
        }
      >
        <ul className="space-y-4">
          {themes.map((theme) => {
            const latestVersion = pickLatestVersion(theme.versions);

            return (
              <li
                key={theme.id}
                className="rounded-xl border border-ctp-surface0 bg-ctp-base p-3 transition hover:border-ctp-surface1 sm:p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
                  {/* Screenshot */}
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-ctp-surface0 bg-ctp-surface0 sm:aspect-[16/10] sm:w-44 sm:self-start">
                    <Image
                      src={theme.screenshotUrl}
                      alt={theme.name}
                      fill
                      // Same sizes as ThemeCard on purpose: the browser then picks the
                      // same srcset width, so this reuses the gallery's already cached
                      // transformation instead of requesting (and paying for) a new
                      // one. A literal "128px" fetched a copy smaller than the
                      // object-cover crop is drawn at, which is what made it blurry.
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover object-top-left"
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/${author}/${theme.slug}`}
                          className="break-words text-lg font-semibold text-ctp-text hover:underline"
                        >
                          {theme.name}
                        </Link>
                        <p className="break-words font-mono text-sm text-ctp-subtext0">
                          {theme.slug} ·{" "}
                          {formatVersion(latestVersion?.version ?? "1.0")}
                        </p>
                      </div>
                      {/* Apart from the everyday actions below, so it's not
                          what a hurried click lands on. */}
                      <button
                        ref={buttonRef(theme.slug)}
                        onClick={() => setDeleting(theme)}
                        type="button"
                        className={`${ICON_DELETE_BUTTON} -mt-1 -mr-1 size-9`}
                        title="Delete theme"
                        aria-label={`Delete ${theme.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {theme.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-ctp-subtext0">
                        {theme.description}
                      </p>
                    )}

                    {/* Stats - an icon each instead of "·" separators, which
                        would be left dangling at the end of a wrapped line on
                        a phone. */}
                    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ctp-subtext0">
                      <span
                        className="flex items-center gap-1.5"
                        title={`${theme.downloads.toLocaleString("en-US")} downloads`}
                      >
                        <Download aria-hidden="true" className="size-4" />
                        {formatDownloads(theme.downloads)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Layers aria-hidden="true" className="size-4" />
                        {versionCount(theme.versions.length)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarClock aria-hidden="true" className="size-4" />
                        <span>
                          Updated <LocalDate date={theme.updatedAt} />
                        </span>
                      </span>
                    </p>

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => setEditingMetadata(theme.slug)}
                        type="button"
                        className={`${buttonClass("secondary", "sm")} flex-1 whitespace-nowrap sm:flex-none`}
                        aria-label={`Edit details of ${theme.name}`}
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                        Edit details
                      </button>
                      <button
                        onClick={() => startVersion(theme.slug)}
                        type="button"
                        disabled={startingVersion !== null}
                        className={`${buttonClass("secondary", "sm")} flex-1 whitespace-nowrap sm:flex-none`}
                        aria-label={`New version of ${theme.name}`}
                      >
                        {startingVersion === theme.slug ? (
                          <Loader2
                            aria-hidden="true"
                            className="size-4 animate-spin"
                          />
                        ) : (
                          <Upload aria-hidden="true" className="size-4" />
                        )}
                        New version
                      </button>
                    </div>

                    {versionError?.slug === theme.slug && (
                      <p role="alert" className="mt-3 text-sm text-ctp-red">
                        {versionError.message}
                        {versionError.code === "too_many_drafts" && (
                          <>
                            .{" "}
                            <Link href="/settings#drafts" className="underline">
                              Manage your drafts
                            </Link>
                            .
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <ThemeVersions author={author} theme={theme} />
              </li>
            );
          })}
        </ul>
      </SettingsSection>

      {deleting && (
        <ConfirmDialog
          title="Delete theme?"
          confirmLabel="Delete theme"
          busyLabel="Deleting…"
          onConfirm={() => deleteTheme(deleting)}
          onCancel={() => setDeleting(null)}
        >
          <p>
            <span className="text-ctp-text font-semibold">{deleting.name}</span>{" "}
            <span className="break-words font-mono">
              ({author}/{deleting.slug})
            </span>{" "}
            is deleted, {versionsPhrase(deleting.versions.length)}. Its page and{" "}
            <code className="break-words text-ctp-subtext1">
              stellar apply {author}/{deleting.slug}
            </code>{" "}
            stop working for everyone - people who already downloaded it keep
            their local copy.
          </p>
          <p className="text-ctp-red">This can't be undone.</p>
        </ConfirmDialog>
      )}

      {/* Edit Metadata Modal */}
      {editingTheme && (
        <EditMetadataForm
          author={author}
          theme={editingTheme}
          colorSchemes={colorSchemes}
          groups={groups}
          onCancel={() => setEditingMetadata(null)}
        />
      )}
    </>
  );
}
