"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function ApplyCommand({
  author,
  theme,
}: {
  author: string;
  theme: string;
}) {
  const [copiedApply, setCopiedApply] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);

  const copy = async (command: string, setCopied: (value: boolean) => void) => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 10000);
  };

  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-stretch gap-4">
      <div className="bg-ctp-crust rounded-xl p-4 px-6 flex-1 flex items-center justify-between gap-4">
        <code className="text-sm">
          stellar apply {author}/{theme}
        </code>
        <button
          onClick={() =>
            copy(`stellar apply ${author}/${theme}`, setCopiedApply)
          }
          type="button"
          className={cn(
            "ml-4 p-2 rounded flex items-center justify-center",
            !copiedApply &&
              "bg-ctp-surface0 ring-1 ring-offset-2 ring-ctp-surface0 ring-offset-ctp-crust cursor-pointer",
          )}
        >
          {copiedApply ? (
            <Check className="w-4 h-4 text-ctp-green" />
          ) : (
            <Copy className="w-4 h-4 text-ctp-text" />
          )}
        </button>
      </div>
      <button
        onClick={() =>
          copy(`stellar preview ${author}/${theme}`, setCopiedPreview)
        }
        type="button"
        className={cn(
          "bg-ctp-crust rounded-xl px-6 py-3 flex items-center justify-center gap-2 text-sm font-medium cursor-pointer transition hover:ring-2 ring-offset-2 ring-offset-ctp-base hover:ring-ctp-surface0",
          copiedPreview ? "text-ctp-green" : "text-ctp-text",
        )}
      >
        {copiedPreview ? (
          <Check className="w-4 h-4 text-ctp-green" />
        ) : (
          <Copy className="w-4 h-4 text-ctp-text" />
        )}
        Preview command
      </button>
    </div>
  );
}
