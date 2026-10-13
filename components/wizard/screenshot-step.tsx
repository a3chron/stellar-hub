"use client";

import { ImageUp, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
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
 *
 * The error lives in the wizard, which also marks a rejected screenshot on
 * the step's bar.
 */
export default function ScreenshotStep({
  draft,
  onDraft,
  onGone,
  error,
  onError,
}: {
  draft: Draft;
  onDraft: (draft: Draft) => void;
  onGone: () => void;
  error: string | null;
  onError: (error: string | null) => void;
}) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    const problem = validateScreenshotFile(file);
    if (problem) {
      onError(problem);
      return;
    }

    onError(null);
    setUploading(true);
    const body = new FormData();
    body.append("screenshot", file);
    const result = await apiFetch<Draft>(
      `/api/drafts/${draft.code}/screenshot`,
      { method: "PUT", body },
    );
    setUploading(false);

    if (result.ok) {
      onDraft(result.data);
    } else if (result.status === 404) {
      onGone();
    } else {
      onError(result.error.error);
    }
  }

  // Resolves with the message to show in the dialog, or null once removed.
  async function remove(): Promise<string | null> {
    const result = await apiFetch<Draft>(
      `/api/drafts/${draft.code}/screenshot`,
      { method: "DELETE" },
    );

    if (result.ok) {
      setConfirmingRemove(false);
      onError(null);
      onDraft(result.data);
      return null;
    }
    if (result.status === 404) {
      setConfirmingRemove(false);
      onGone();
      return null;
    }
    return result.error.error;
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
          !!error && !dragging && "border-ctp-red/60!",
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
        {uploading && (
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
          disabled={uploading}
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
            onClick={() => setConfirmingRemove(true)}
            disabled={uploading}
            className="flex shrink-0 items-center gap-1.5 text-xs text-ctp-subtext0 hover:text-ctp-red transition cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={14} />
            Remove
          </button>
        )}
      </div>

      {confirmingRemove && (
        <ConfirmDialog
          title="Remove screenshot?"
          confirmLabel="Remove"
          busyLabel="Removing..."
          onConfirm={remove}
          onCancel={() => setConfirmingRemove(false)}
        >
          <p>
            The uploaded screenshot is deleted from this draft. You'll need to
            add one again before you can publish.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
