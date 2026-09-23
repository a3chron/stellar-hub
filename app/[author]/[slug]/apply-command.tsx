"use client";

import { Check, Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CopyStatus = "idle" | "copied" | "failed";

export default function ApplyCommand({
  author,
  theme,
}: {
  author: string;
  theme: string;
}) {
  const [applyStatus, setApplyStatus] = useState<CopyStatus>("idle");
  const [previewStatus, setPreviewStatus] = useState<CopyStatus>("idle");

  // One timer per button, so a second click on the same button restarts its
  // own reset-to-idle rather than stacking another timer that later fires
  // and resets state an in-between click just set.
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  const copy = async (
    command: string,
    setStatus: (value: CopyStatus) => void,
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  ) => {
    try {
      await navigator.clipboard.writeText(command);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setStatus("idle");
    }, 10000);
  };

  const copyFailed = applyStatus === "failed" || previewStatus === "failed";

  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-stretch gap-4">
      {/* Announces a failed copy to screen readers - the icon/label change
          alone isn't reliably picked up unless the button already has
          focus, which is the state a keyboard/AT user is actually in here,
          but this covers mouse users too. */}
      <output aria-live="polite" className="sr-only">
        {copyFailed && "Copy failed"}
      </output>
      <div className="bg-ctp-crust rounded-xl p-4 px-6 flex-1 flex items-center justify-between gap-4">
        <code className="text-sm">
          stellar apply {author}/{theme}
        </code>
        <button
          onClick={() =>
            copy(
              `stellar apply ${author}/${theme}`,
              setApplyStatus,
              applyTimerRef,
            )
          }
          type="button"
          aria-label={
            applyStatus === "failed"
              ? "Copy apply command failed"
              : "Copy apply command"
          }
          className={cn(
            "ml-4 p-2 rounded flex items-center justify-center",
            applyStatus === "idle" &&
              "bg-ctp-surface0 ring-1 ring-offset-2 ring-ctp-surface0 ring-offset-ctp-crust cursor-pointer",
          )}
        >
          {applyStatus === "copied" && (
            <Check className="w-4 h-4 text-ctp-green" />
          )}
          {applyStatus === "failed" && <X className="w-4 h-4 text-ctp-red" />}
          {applyStatus === "idle" && <Copy className="w-4 h-4 text-ctp-text" />}
        </button>
      </div>
      <button
        onClick={() =>
          copy(
            `stellar preview ${author}/${theme}`,
            setPreviewStatus,
            previewTimerRef,
          )
        }
        type="button"
        aria-label={
          previewStatus === "failed"
            ? "Copy preview command failed"
            : "Copy preview command"
        }
        className={cn(
          "bg-ctp-crust rounded-xl px-6 py-3 flex items-center justify-center gap-2 text-sm font-medium cursor-pointer transition hover:ring-2 ring-offset-2 ring-offset-ctp-base hover:ring-ctp-surface0",
          previewStatus === "copied" && "text-ctp-green",
          previewStatus === "failed" && "text-ctp-red",
          previewStatus === "idle" && "text-ctp-text",
        )}
      >
        {previewStatus === "copied" && (
          <Check className="w-4 h-4 text-ctp-green" />
        )}
        {previewStatus === "failed" && <X className="w-4 h-4 text-ctp-red" />}
        {previewStatus === "idle" && <Copy className="w-4 h-4 text-ctp-text" />}
        {previewStatus === "failed" ? "Copy failed" : "Preview command"}
      </button>
    </div>
  );
}
