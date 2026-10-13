"use client";

import { ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { LocalDate, TimeAgo } from "@/components/local-time";
import type { Draft, DraftStatus } from "@/lib/draft-shared";
import { apiFetch } from "@/lib/drafts-client";
import { cn } from "@/lib/utils";
import { formatVersion } from "@/lib/versions";
import { useFocusAfterRemoval } from "./use-focus-after-removal";

const STATUS_STYLES: Record<DraftStatus, string> = {
  waiting_for_config: "text-ctp-peach border-ctp-peach/40 bg-ctp-peach/10",
  incomplete: "text-ctp-yellow border-ctp-yellow/40 bg-ctp-yellow/10",
  ready: "text-ctp-green border-ctp-green/40 bg-ctp-green/10",
};

function statusLabel(draft: Draft): string {
  if (draft.status === "ready") {
    return "Ready to publish";
  }
  if (draft.status === "waiting_for_config") {
    return "Waiting for config";
  }
  return `Needs ${draft.missing.join(", ")}`;
}

function draftTitle(draft: Draft): string {
  if (draft.kind === "version") {
    const version = draft.version ? formatVersion(draft.version) : "?";
    return `${draft.theme?.name ?? "Theme"} → ${version}`;
  }
  return draft.name || draft.slug || "Untitled theme";
}

/**
 * Unfinished themes and versions - from the upload wizard or
 * `stellar publish`. Expired ones are already gone by the time this renders.
 */
export default function Drafts({ drafts }: { drafts: Draft[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<Draft | null>(null);
  const { headingRef, buttonRef, removing } = useFocusAfterRemoval(
    drafts.map((draft) => draft.code),
  );

  // Resolves with the message to show in the dialog, or null once deleted.
  async function deleteDraft(draft: Draft): Promise<string | null> {
    const result = await apiFetch<void>(`/api/drafts/${draft.code}`, {
      method: "DELETE",
    });

    // A 404 means it's gone already, which is what was asked for.
    if (result.ok || result.status === 404) {
      removing(draft.code);
      setDeleting(null);
      router.refresh();
      return null;
    }
    return result.error.error;
  }

  return (
    <section
      id="drafts"
      className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8 scroll-mt-24"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold text-ctp-text mb-2 focus:outline-none"
      >
        Drafts{drafts.length > 0 && ` (${drafts.length})`}
      </h2>
      <p className="text-sm text-ctp-subtext0 mb-6 leading-relaxed">
        Themes and versions you started but haven't published yet. A draft is
        kept for 7 days after its last change.
      </p>

      {drafts.length === 0 && (
        <p className="text-sm text-ctp-subtext0">
          No drafts right now - start one from{" "}
          <Link href="/upload" className="underline">
            Upload
          </Link>{" "}
          or with <code className="text-ctp-subtext1">stellar publish</code>.
        </p>
      )}

      {drafts.length > 0 && (
        <ul className="space-y-3">
          {drafts.map((draft) => {
            return (
              <li
                key={draft.code}
                className="bg-ctp-base rounded-lg border border-ctp-surface0 p-4"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ctp-text font-semibold truncate">
                        {draftTitle(draft)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          STATUS_STYLES[draft.status],
                        )}
                      >
                        {statusLabel(draft)}
                      </span>
                    </div>
                    <p className="text-sm text-ctp-subtext0 font-mono mt-1">
                      {draft.kind === "theme"
                        ? `${draft.slug} · new theme`
                        : `${draft.theme?.slug} · new version`}{" "}
                      · {draft.code}
                    </p>
                    <p className="text-xs text-ctp-subtext0 mt-2">
                      Updated <TimeAgo date={draft.updatedAt} /> · kept until{" "}
                      <LocalDate date={draft.expiresAt} />
                      {draft.source && <> · from {draft.source}</>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/upload/${draft.code}`}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-md border-2 border-ctp-surface1 transition"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <button
                      ref={buttonRef(draft.code)}
                      onClick={() => setDeleting(draft)}
                      type="button"
                      className="p-2 text-ctp-subtext0 hover:text-ctp-red hover:bg-ctp-surface0 rounded transition cursor-pointer"
                      title="Delete draft"
                      aria-label={`Delete draft ${draft.code}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete draft?"
          confirmLabel="Delete draft"
          busyLabel="Deleting…"
          onConfirm={() => deleteDraft(deleting)}
          onCancel={() => setDeleting(null)}
        >
          <p>
            <span className="text-ctp-text font-semibold">
              {draftTitle(deleting)}
            </span>{" "}
            (draft <span className="font-mono">{deleting.code}</span>)
            {deleting.kind === "theme"
              ? " is deleted, together with its config and screenshot."
              : " is deleted - the published theme itself isn't touched."}{" "}
            Its link stops working, including for a pending{" "}
            <code className="text-ctp-subtext1">stellar publish --draft</code>.
          </p>
          <p className="text-ctp-red">This can't be undone.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
