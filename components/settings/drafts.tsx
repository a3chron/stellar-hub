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
import SettingsSection, {
  buttonClass,
  ICON_DELETE_BUTTON,
} from "./settings-section";
import { useFocusAfterRemoval } from "./use-focus-after-removal";

// The status colour is carried by the border, tint and dot; the text itself
// stays in the theme's text colour, since peach, yellow and green text don't
// reach a readable contrast on the light (Latte) background.
const STATUS_STYLES: Record<DraftStatus, { chip: string; dot: string }> = {
  waiting_for_config: {
    chip: "border-ctp-peach/60 bg-ctp-peach/10",
    dot: "bg-ctp-peach",
  },
  incomplete: {
    chip: "border-ctp-yellow/60 bg-ctp-yellow/10",
    dot: "bg-ctp-yellow",
  },
  ready: { chip: "border-ctp-green/60 bg-ctp-green/10", dot: "bg-ctp-green" },
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
    <SettingsSection
      id="drafts"
      title="Drafts"
      count={drafts.length}
      headingRef={headingRef}
      description="Themes and versions you started but haven't published yet. A draft is kept for 7 days after its last change."
    >
      {drafts.length === 0 && (
        <p className="text-sm text-ctp-subtext0">
          No drafts right now - start one from{" "}
          <Link
            href="/upload"
            className="text-ctp-lavender underline underline-offset-2"
          >
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
                className="flex flex-col gap-3 rounded-lg border border-ctp-surface0 bg-ctp-base p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
                    <span className="min-w-0 break-words font-semibold text-ctp-text">
                      {draftTitle(draft)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-ctp-text",
                        STATUS_STYLES[draft.status].chip,
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 rounded-full",
                          STATUS_STYLES[draft.status].dot,
                        )}
                      />
                      {statusLabel(draft)}
                    </span>
                  </div>
                  <p className="mt-1.5 break-words font-mono text-sm text-ctp-subtext0">
                    {draft.kind === "theme"
                      ? `${draft.slug} · new theme`
                      : `${draft.theme?.slug} · new version`}{" "}
                    · {draft.code}
                  </p>
                  <p className="mt-1 text-xs text-ctp-subtext0">
                    Updated <TimeAgo date={draft.updatedAt} /> · kept until{" "}
                    <LocalDate date={draft.expiresAt} />
                    {draft.source && <> · from {draft.source}</>}
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:shrink-0">
                  <Link
                    href={`/upload/${draft.code}`}
                    className={`${buttonClass("secondary")} flex-1 sm:flex-none`}
                  >
                    Continue
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                  <button
                    ref={buttonRef(draft.code)}
                    onClick={() => setDeleting(draft)}
                    type="button"
                    className={`${ICON_DELETE_BUTTON} size-10`}
                    title="Delete draft"
                    aria-label={`Delete draft ${draft.code}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
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
    </SettingsSection>
  );
}
