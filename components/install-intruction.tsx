"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function InstallInstruction() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="p-3 px-4 group rounded-xl border-2 border-ctp-text bg-ctp-text text-lg text-ctp-crust font-medium flex items-center">
      <span className="hidden sm:block">Install</span>
      <div className="h-full w-0.5 rounded-full bg-ctp-subtext0 mx-2 hidden sm:block" />
      <span className="relative max-w-44 whitespace-nowrap overflow-hidden">
        <span className="block">
          curl -fsSL
          https://raw.githubusercontent.com/a3chron/stellar/main/install.sh |
          bash
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-ctp-text to-transparent" />
      </span>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(
            "curl -fsSL https://raw.githubusercontent.com/a3chron/stellar/main/install.sh | bash",
          );
          setCopied(true);
          setTimeout(() => setCopied(false), 10000);
        }}
        type="button"
        className={cn(
          "ml-4 p-2 rounded flex items-center justify-center",
          !copied && "cursor-pointer",
        )}
      >
        {copied ? (
          <Check className="w-5 h-5 text-ctp-crust" />
        ) : (
          <Copy className="w-5 h-5 text-ctp-crust" />
        )}
      </button>
    </div>
  );
}
