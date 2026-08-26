"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function CopyButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      }}
      type="button"
      aria-label="Copy to clipboard"
      className={cn(
        "p-2 rounded-lg border-2 flex items-center justify-center transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-surface0",
        copied
          ? "border-ctp-green/70 bg-ctp-green/10"
          : "border-ctp-crust bg-ctp-mantle hover:ring-2 ring-offset-2 ring-offset-ctp-mantle hover:ring-ctp-surface0",
        className,
      )}
    >
      {copied ? (
        <Check className="w-4 h-4 text-ctp-green" />
      ) : (
        <Copy className="w-4 h-4 text-ctp-subtext0" />
      )}
    </button>
  );
}
