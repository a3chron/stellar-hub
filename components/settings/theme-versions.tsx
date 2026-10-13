"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { LocalDate } from "@/components/local-time";
import type { Theme, ThemeVersion } from "@/lib/db/types";
import { apiFetch } from "@/lib/drafts-client";
import { cn } from "@/lib/utils";
import { formatVersion, sortVersionsDesc } from "@/lib/versions";
import { ICON_DELETE_BUTTON } from "./settings-section";
import { useFocusAfterRemoval } from "./use-focus-after-removal";

/** What settings loads per version - not the config. */
export type ListedVersion = Pick<
  ThemeVersion,
  "version" | "versionNotes" | "createdAt"
>;

interface ThemeVersionsProps {
  author: string;
  theme: Pick<Theme, "name" | "slug"> & { versions: ListedVersion[] };
}

/**
 * A theme's versions behind a disclosure, newest first. Every version but the
 * latest can be deleted - the DELETE handler in
 * app/api/[author]/[slug]/[version]/route.ts explains why never the latest.
 */
export default function ThemeVersions({ author, theme }: ThemeVersionsProps) {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<ListedVersion | null>(null);

  const versions = sortVersionsDesc(theme.versions);
  const latest = versions[0]?.version;
  // Once the last deletable version is gone, focus falls back to the
  // disclosure button - the list has no heading of its own.
  const {
    headingRef: toggleRef,
    buttonRef,
    removing,
  } = useFocusAfterRemoval<HTMLButtonElement>(
    versions
      .filter((entry) => entry.version !== latest)
      .map((entry) => entry.version),
  );

  // Resolves with the message to show in the dialog, or null once deleted.
  async function deleteVersion(entry: ListedVersion): Promise<string | null> {
    const result = await apiFetch<{ success: true }>(
      `/api/${author}/${theme.slug}/${entry.version}`,
      { method: "DELETE" },
    );

    // Already gone (deleted in another tab) is what was asked for.
    if (result.ok || result.error.code === "version_not_found") {
      removing(entry.version);
      setDeleting(null);
      router.refresh();
      return null;
    }
    return result.error.error;
  }

  return (
    <div className="mt-4 border-t border-ctp-surface0 pt-3">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={listId}
        className="-mx-1 flex items-center gap-1.5 rounded px-1 py-0.5 text-sm font-medium text-ctp-subtext1 transition hover:text-ctp-text cursor-pointer"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn("size-4 transition-transform", open && "rotate-90")}
        />
        {/* Every theme has one of these - the name tells them apart for a
            screen reader listing the buttons. */}
        <span>
          Versions<span className="sr-only"> of {theme.name}</span>
          {` (${versions.length})`}
        </span>
      </button>

      {/* Kept in the DOM while collapsed, so aria-controls always points at
          something. */}
      <div id={listId} hidden={!open}>
        <ul className="mt-3 divide-y divide-ctp-surface0 rounded-lg border border-ctp-surface0">
          {versions.map((entry) => {
            const isLatest = entry.version === latest;

            return (
              <li
                key={entry.version}
                className="flex items-center gap-3 py-2 pr-2 pl-3"
              >
                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:shrink-0 sm:flex-nowrap">
                    <span className="font-mono text-sm font-semibold text-ctp-text sm:w-14">
                      {formatVersion(entry.version)}
                    </span>
                    {isLatest ? (
                      <span className="inline-flex items-center justify-center rounded-full border border-ctp-blue/50 bg-ctp-blue/10 px-2 py-0.5 text-xs text-ctp-text sm:w-16">
                        Latest
                      </span>
                    ) : (
                      // Holds the badge's column, so the dates line up.
                      <span
                        aria-hidden="true"
                        className="hidden sm:block sm:w-16"
                      />
                    )}
                    <span className="text-xs tabular-nums text-ctp-subtext0 sm:w-20">
                      <LocalDate date={entry.createdAt} />
                    </span>
                  </div>
                  {entry.versionNotes && (
                    <p
                      title={entry.versionNotes}
                      className="mt-0.5 truncate text-sm text-ctp-subtext0 sm:mt-0 sm:min-w-0 sm:flex-1"
                    >
                      {entry.versionNotes}
                    </p>
                  )}
                </div>

                {isLatest ? (
                  // Keeps the rows' right edges aligned without offering a
                  // button that could only ever be disabled.
                  <span aria-hidden="true" className="size-8 shrink-0" />
                ) : (
                  <button
                    ref={buttonRef(entry.version)}
                    type="button"
                    onClick={() => setDeleting(entry)}
                    className={`${ICON_DELETE_BUTTON} size-8`}
                    title="Delete version"
                    aria-label={`Delete ${theme.name} ${formatVersion(entry.version)}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-ctp-subtext0">
          The latest version can't be deleted - publish a newer one first, or
          delete the whole theme.
        </p>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete version?"
          confirmLabel="Delete version"
          busyLabel="Deleting…"
          onConfirm={() => deleteVersion(deleting)}
          onCancel={() => setDeleting(null)}
        >
          <p>
            <span className="font-semibold text-ctp-text">
              {theme.name} {formatVersion(deleting.version)}
            </span>{" "}
            is deleted.{" "}
            <code className="break-words text-ctp-subtext1">
              stellar apply {author}/{theme.slug}@{deleting.version}
            </code>{" "}
            stops working for everyone and it disappears from the theme page -
            people who already downloaded it keep their copy.
          </p>
          <p>
            The number {deleting.version} can't be used again: new versions
            always have to be newer than the latest one.
          </p>
          <p className="text-ctp-red">This can't be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
