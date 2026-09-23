"use client";

import { ShieldAlertIcon, TextSearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { ConfigPreviewModal } from "@/components/config-preview-modal";
import Tooltip from "@/components/tooltip";
import type { ThemeVersion } from "@/lib/db/types";

interface ThemeVersionsSectionProps {
  author: string;
  slug: string;
  versions: ThemeVersion[];
  /** version string -> whether that version defines custom commands. */
  hasCustomByVersion: Record<string, boolean>;
}

function VersionRows({
  versions,
  hasCustomByVersion,
  onView,
}: {
  versions: ThemeVersion[];
  hasCustomByVersion: Record<string, boolean>;
  onView: (version: string) => void;
}) {
  return (
    <>
      {versions.map((version) => (
        <div
          key={version.id}
          className="border-l-4 border-ctp-subtext0 bg-ctp-crust rounded-r-xl px-4 py-2 mb-4 w-full max-w-lg"
        >
          <div className="flex justify-between gap-4">
            <div className="flex gap-3 items-center">
              <h3 className="font-semibold">{version.version}</h3>
              <button
                type="button"
                onClick={() => onView(version.version)}
                className="flex items-center gap-1.5 text-xs cursor-pointer text-ctp-subtext0 hover:text-ctp-text transition-colors"
                aria-label={
                  hasCustomByVersion[version.version]
                    ? `View config for version ${version.version} (contains custom commands)`
                    : `View config for version ${version.version}`
                }
              >
                {hasCustomByVersion[version.version] ? (
                  <ShieldAlertIcon size={16} className="text-ctp-peach" />
                ) : (
                  <TextSearchIcon size={16} />
                )}
                View config
              </button>
              {hasCustomByVersion[version.version] && (
                <Tooltip
                  content="Runs shell commands defined in this config - review before applying"
                  contentClassName="max-w-xs whitespace-normal"
                >
                  {/* Not a <button> - it doesn't do anything on click, so a
                      real button would be a dead control for screen reader
                      and keyboard users. The explanation is always available
                      as visible-on-hover (via Tooltip) and permanent sr-only
                      text, rather than gated behind a focus this element
                      can't receive. */}
                  <span className="flex items-center gap-1 rounded-full bg-ctp-peach/10 px-2 py-0.5 text-xs font-medium text-ctp-peach">
                    <ShieldAlertIcon size={12} aria-hidden="true" />
                    Custom commands
                    <span className="sr-only">
                      : runs shell commands defined in this config - review
                      before applying
                    </span>
                  </span>
                </Tooltip>
              )}
            </div>
            {version.minStarshipVersion && (
              <span>
                starship {">="} {version.minStarshipVersion}
              </span>
            )}
          </div>
          {version.versionNotes && (
            <p className="text-ctp-subtext1 mt-1.5">{version.versionNotes}</p>
          )}
        </div>
      ))}
    </>
  );
}

// Reads the `review` query param so a link like `/author/slug?review=1.0`
// (the CLI hands this out when it refuses to apply a theme with `[custom.*]`
// sections without confirmation) opens the config modal on that version
// automatically. Needs its own client boundary because useSearchParams()
// requires a Suspense ancestor - see app/login/page.tsx for the same pattern.
function ThemeVersionsSectionInner({
  author,
  slug,
  versions,
  hasCustomByVersion,
}: ThemeVersionsSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewParam = searchParams.get("review");

  // `stellar apply <author>/<theme>@latest` keeps "latest" literally - the
  // CLI only resolves it to a concrete version when no version was given - so
  // the link can name a version that does not exist as a row. Map it to the
  // newest version rather than silently opening nothing; the versions list is
  // ordered newest-first by the page that renders it.
  const resolveReviewVersion = () => {
    if (!reviewParam) {
      return null;
    }
    if (reviewParam === "latest") {
      return versions[0]?.version ?? null;
    }
    if (versions.some((v) => v.version === reviewParam)) {
      return reviewParam;
    }
    return null;
  };

  const deepLinkVersion = resolveReviewVersion();

  // Only used to seed initial state - once open, closing/reopening a
  // different version is driven entirely by openVersion below.
  const [openVersion, setOpenVersion] = useState<string | null>(
    deepLinkVersion,
  );

  const handleClose = useCallback(() => {
    setOpenVersion(null);

    // Strip a stale `review` param out of the URL so a refresh or
    // back-navigation doesn't reopen the modal.
    if (searchParams.has("review")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("review");
      const query = params.toString();
      router.replace(`/${author}/${slug}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    }
  }, [author, slug, router, searchParams]);

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Versions</h2>
      <VersionRows
        versions={versions}
        hasCustomByVersion={hasCustomByVersion}
        onView={setOpenVersion}
      />

      <ConfigPreviewModal
        key={openVersion ?? "none"}
        author={author}
        slug={slug}
        version={openVersion ?? ""}
        isOpen={openVersion !== null}
        onClose={handleClose}
      />
    </section>
  );
}

function ThemeVersionsSectionFallback({
  versions,
  hasCustomByVersion,
}: {
  versions: ThemeVersion[];
  hasCustomByVersion: Record<string, boolean>;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Versions</h2>
      <VersionRows
        versions={versions}
        hasCustomByVersion={hasCustomByVersion}
        onView={() => {}}
      />
    </section>
  );
}

export function ThemeVersionsSection(props: ThemeVersionsSectionProps) {
  return (
    <Suspense
      fallback={
        <ThemeVersionsSectionFallback
          versions={props.versions}
          hasCustomByVersion={props.hasCustomByVersion}
        />
      }
    >
      <ThemeVersionsSectionInner {...props} />
    </Suspense>
  );
}
