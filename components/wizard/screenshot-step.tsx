"use client";

import { ImageUp, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";
import type { Draft } from "@/lib/draft-shared";
import { apiFetch } from "@/lib/drafts-client";
import {
  ACCEPTED_SCREENSHOT_TYPES,
  validateScreenshotFile,
} from "@/lib/screenshot-validation";
import { cn } from "@/lib/utils";

/**
 * Uploads the screenshot the moment it is picked (or dropped), so it is part
 * of the draft - and visible to `stellar publish --publish` - right away.
 */
export default function ScreenshotStep({
  draft,
  onDraft,
  onGone,
}: {
  draft: Draft;
  onDraft: (draft: Draft) => void;
  onGone: () => void;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    const problem = validateScreenshotFile(file);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setBusy("upload");
    const body = new FormData();
    body.append("screenshot", file);
    const result = await apiFetch<Draft>(
      `/api/drafts/${draft.code}/screenshot`,
      { method: "PUT", body },
    );
    setBusy(null);

    if (result.ok) {
      onDraft(result.data);
    } else if (result.status === 404) {
      onGone();
    } else {
      setError(result.error.error);
    }
  }

  async function remove() {
    setError(null);
    setBusy("remove");
    const result = await apiFetch<Draft>(
      `/api/drafts/${draft.code}/screenshot`,
      { method: "DELETE" },
    );
    setBusy(null);

    if (result.ok) {
      onDraft(result.data);
    } else if (result.status === 404) {
      onGone();
    } else {
      setError(result.error.error);
    }
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) {
            upload(file);
          }
        }}
        className={cn(
          "relative flex h-64 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed bg-ctp-mantle text-sm text-ctp-subtext0 transition",
          dragging ? "border-ctp-lavender" : "border-ctp-surface0",
        )}
      >
        {draft.screenshotUrl ? (
          <Image
            src={draft.screenshotUrl}
            alt="Theme screenshot"
            fill
            // A draft's screenshot is shown a handful of times at most - not
            // worth an optimised (and billed) transformation.
            unoptimized
            className="object-cover object-top-left"
          />
        ) : (
          <>
            <ImageUp className="h-8 w-8 text-ctp-overlay1" />
            <span>
              <span className="text-ctp-text">Choose a screenshot</span> or drop
              it here
            </span>
          </>
        )}
        {busy === "upload" && (
          <span className="absolute inset-0 flex items-center justify-center bg-ctp-base/70">
            <Loader2 className="h-6 w-6 animate-spin text-ctp-text" />
          </span>
        )}
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED_SCREENSHOT_TYPES.join(",")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              upload(file);
            }
          }}
          disabled={busy !== null}
          className="sr-only"
        />
      </label>

      <div className="flex items-center justify-between gap-4">
        {error ? (
          <p role="alert" className="text-xs text-ctp-red">
            {error}
          </p>
        ) : (
          <p className="text-xs text-ctp-subtext0">
            PNG, JPG, or WebP. Max 4MB. Uploaded right away
            {draft.screenshotUrl ? " - click the image to replace it." : "."}
          </p>
        )}
        {draft.screenshotUrl && (
          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            className="flex shrink-0 items-center gap-1.5 text-xs text-ctp-subtext0 hover:text-ctp-red transition cursor-pointer disabled:opacity-50"
          >
            {busy === "remove" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
