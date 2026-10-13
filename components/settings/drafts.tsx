"use client";

import { ArrowRight, Loader2, Trash2, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalDate, TimeAgo } from "@/components/local-time";
import type { Draft, DraftStatus } from "@/lib/draft-shared";
import { apiFetch } from "@/lib/drafts-client";
import { cn } from "@/lib/utils";

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
    return `${draft.theme?.name ?? "Theme"} → v${draft.version ?? "?"}`;
  }
  return draft.name || draft.slug || "Untitled theme";
}

/**
 * Unfinished themes and versions - from the upload wizard or
 * `stellar publish`. Expired ones are already gone by the time this renders.
 */
export default function Drafts({ drafts }: { drafts: Draft[] }) {
  const router = useRouter();
  const [confirmCode, setConfirmCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(code: string) {
    if (confirmCode !== code) {
      setConfirmCode(code);
      setError(null);
      return;
    }

    setDeletingCode(code);
    setError(null);
    const result = await apiFetch<void>(`/api/drafts/${code}`, {
      method: "DELETE",
    });
    setDeletingCode(null);

    // A 404 means it's gone already, which is what was asked for.
    if (result.ok || result.status === 404) {
      setConfirmCode(null);
      router.refresh();
      return;
    }
    setError(result.error.error);
  }

  return (
    <section
      id="drafts"
      className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8 scroll-mt-24"
    >
      <h2 className="text-2xl font-semibold text-ctp-text mb-2">
        Drafts ({drafts.length})
      </h2>
      <p className="text-sm text-ctp-subtext0 mb-6 leading-relaxed">
        Themes and versions you started but haven't published yet. A draft is
        kept for 7 days after its last change.
      </p>

      <ul className="space-y-3">
        {drafts.map((draft) => {
          const confirming = confirmCode === draft.code;
          const deleting = deletingCode === draft.code;

          let deleteTitle = "Delete draft";
          if (deleting) {
            deleteTitle = "Deleting...";
          } else if (confirming) {
            deleteTitle = "Click again to confirm";
          }

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
                      ? `${draft.slug} • new theme`
                      : `${draft.theme?.slug} • new version`}{" "}
                    • {draft.code}
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
                    onClick={() => handleDelete(draft.code)}
                    type="button"
                    disabled={deleting}
                    className={`p-2 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                      confirming
                        ? "text-ctp-crust bg-ctp-red rounded-l pr-2.5"
                        : "text-ctp-subtext0 hover:text-ctp-red hover:bg-ctp-surface0 rounded"
                    }`}
                    title={deleteTitle}
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  {confirming && (
                    <button
                      onClick={() => {
                        setConfirmCode(null);
                        setError(null);
                      }}
                      type="button"
                      disabled={deleting}
                      className="p-2 pl-2.5 -ml-2 bg-ctp-surface0 rounded-r text-ctp-text cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      title="Cancel deletion"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {confirming && error && (
                <p role="alert" className="text-sm text-ctp-red mt-3">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
