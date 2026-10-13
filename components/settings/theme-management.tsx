"use client";

import { Download, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { LocalDate } from "@/components/local-time";
import type { ColorScheme } from "@/lib/db/types";
import type { Draft } from "@/lib/draft-shared";
import { apiFetch, existingDraftCode, jsonRequest } from "@/lib/drafts-client";
import type { ThemeGroup } from "@/lib/theme-groups";
import { formatDownloads } from "@/lib/utils";
import { pickLatestVersion } from "@/lib/versions";
import EditMetadataForm from "../edit-metadata-form";

interface Theme {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  screenshotUrl: string;
  downloads: number;
  colorSchemeId: string | null;
  colorMode: "dark" | "light" | "both";
  group: string | null;
  createdAt: Date;
  updatedAt: Date;
  versions: Array<{
    version: string;
    configContent: string;
    dependencies: string[] | null;
    minStarshipVersion: string | null;
  }>;
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
  } | null>(null);
  const [deleting, setDeleting] = useState<Theme | null>(null);

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
      setVersionError({ slug, message: result.error.error });
    }
  };

  // Resolves with the message to show in the dialog, or null once deleted.
  const deleteTheme = async (theme: Theme): Promise<string | null> => {
    try {
      const response = await fetch(`/api/${author}/${theme.slug}`, {
        method: "DELETE",
      });

      if (response.ok) {
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
      <section
        id="themes"
        className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8 scroll-mt-24"
      >
        <h2 className="text-2xl font-semibold text-ctp-text mb-6">
          Your Themes
        </h2>
        <div className="text-center py-12">
          <p className="text-ctp-subtext0 mb-4">
            You haven't uploaded any themes yet
          </p>
          <a
            href="/upload"
            className="inline-block px-6 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded border border-ctp-surface1 transition"
          >
            Upload Your First Theme
          </a>
        </div>
      </section>
    );
  }

  const editingTheme = themes.find((t) => t.slug === editingMetadata);

  return (
    <>
      <section
        id="themes"
        className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8 scroll-mt-24"
      >
        <h2 className="text-2xl font-semibold text-ctp-text mb-6">
          Your Themes ({themes.length})
        </h2>

        <div className="space-y-4">
          {themes.map((theme) => {
            const latestVersion = pickLatestVersion(theme.versions);

            return (
              <div
                key={theme.id}
                className="bg-ctp-base rounded-lg border border-ctp-surface0 p-4 hover:border-ctp-surface1 transition"
              >
                <div className="flex items-start gap-4">
                  {/* Screenshot */}
                  <div className="relative w-32 h-20 rounded overflow-hidden shrink-0 bg-ctp-surface0">
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          href={`/${author}/${theme.slug}`}
                          className="text-lg font-semibold text-ctp-text hover:underline"
                        >
                          {theme.name}
                        </Link>
                        <p className="text-sm text-ctp-subtext0 font-mono">
                          {theme.slug} • v{latestVersion?.version || "1.0"}
                        </p>
                        {theme.description && (
                          <p className="text-sm text-ctp-subtext0 mt-1 line-clamp-2">
                            {theme.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setEditingMetadata(theme.slug)}
                          type="button"
                          className="p-2 hover:bg-ctp-surface0 rounded text-ctp-subtext0 hover:text-ctp-text transition cursor-pointer"
                          title="Edit metadata"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startVersion(theme.slug)}
                          type="button"
                          disabled={startingVersion !== null}
                          className="p-2 hover:bg-ctp-surface0 rounded text-ctp-subtext0 hover:text-ctp-text transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                          title="New version"
                        >
                          {startingVersion === theme.slug ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleting(theme)}
                          type="button"
                          className="p-2 text-ctp-subtext0 hover:text-ctp-red hover:bg-ctp-surface0 rounded transition cursor-pointer"
                          title="Delete theme"
                          aria-label={`Delete ${theme.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 text-sm text-ctp-subtext0">
                      <div className="flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        <span
                          title={`${theme.downloads.toLocaleString("en-US")} downloads`}
                        >
                          {formatDownloads(theme.downloads)}
                        </span>
                      </div>
                      <span>•</span>
                      <span>{theme.versions.length} versions</span>
                      <span>•</span>
                      <span>
                        Updated <LocalDate date={theme.updatedAt} />
                      </span>
                    </div>

                    {versionError?.slug === theme.slug && (
                      <p role="alert" className="mt-3 text-sm text-ctp-red">
                        {versionError.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {deleting && (
        <ConfirmDialog
          title="Delete theme?"
          confirmLabel="Delete theme"
          busyLabel="Deleting..."
          onConfirm={() => deleteTheme(deleting)}
          onCancel={() => setDeleting(null)}
        >
          <p>
            <span className="text-ctp-text font-semibold">{deleting.name}</span>{" "}
            <span className="font-mono">
              ({author}/{deleting.slug})
            </span>{" "}
            is deleted, {versionsPhrase(deleting.versions.length)}. Its page and{" "}
            <code className="text-ctp-subtext1">
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
