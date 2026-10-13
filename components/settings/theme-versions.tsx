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
 * A theme's versions behind a disclosure, newest first. Any version can be
 * deleted as long as one is left; deleting the latest makes the next one
 * down the latest. A deleted number is never published again - see the
 * DELETE handler in app/api/[author]/[slug]/[version]/route.ts.
 */
export default function ThemeVersions({ author, theme }: ThemeVersionsProps) {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<ListedVersion | null>(null);

  const versions = sortVersionsDesc(theme.versions);
  const latest = versions[0]?.version;
  // The only version can't go - that is deleting the theme.
  const deletable = versions.length > 1;
  // Once the last deletable version is gone, focus falls back to the
  // disclosure button - the list has no heading of its own.
  const {
    headingRef: toggleRef,
    buttonRef,
    removing,
  } = useFocusAfterRemoval<HTMLButtonElement>(
    deletable ? versions.map((entry) => entry.version) : [],
  );
  // Deleting the latest hands "latest" to the next one down.
  const nextLatest = versions[1]?.version;

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

                {deletable ? (
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
                ) : (
                  // Keeps the row's right edge where the others have their
                  // button, without offering one that could only be disabled.
                  <span aria-hidden="true" className="size-8 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-ctp-subtext0">
          {deletable
            ? "Deleting the latest makes the one below it the latest. A deleted version number can't be used again."
            : "A theme needs at least one version - to remove this one, delete the whole theme."}
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
            is deleted
            {deleting.version === latest && nextLatest && (
              <>
                {" "}
                and{" "}
                <span className="font-semibold text-ctp-text">
                  {formatVersion(nextLatest)}
                </span>{" "}
                becomes the latest - it's what{" "}
                <code className="break-words text-ctp-subtext1">
                  stellar apply {author}/{theme.slug}
                </code>{" "}
                installs from then on
              </>
            )}
            .{" "}
            <code className="break-words text-ctp-subtext1">
              stellar apply {author}/{theme.slug}@{deleting.version}
            </code>{" "}
            stops working for everyone and it disappears from the theme page -
            people who already downloaded it keep their copy.
          </p>
          <p>
            The number {deleting.version} can't be used again: the next version
            you publish has to be newer than it.
          </p>
          <p className="text-ctp-red">This can't be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
