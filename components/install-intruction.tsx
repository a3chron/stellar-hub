"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function InstallInstruction() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <div
        className={cn(
          "p-3 px-4 group rounded-xl border-2 border-ctp-text bg-ctp-text text-lg text-ctp-crust font-medium flex items-center transition hover:ring-2 ring-offset-4 ring-offset-ctp-base",
          copied ? "hover:ring-ctp-green/70" : "hover:ring-ctp-surface1",
        )}
      >
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
            setTimeout(() => setCopied(false), 4000);
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
      <span className="text-xs absolute -bottom-6 text-ctp-subtext0 ml-4">
        Check what the script is doing:{" "}
        <Link
          href={"https://github.com/a3chron/stellar/blob/main/install.sh"}
          target="_blank"
          className="text-ctp-text underline"
        >
          install.sh
        </Link>
      </span>
    </div>
  );
}
