"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export default function ApplyCommand({
  author,
  theme,
}: {
  author: string;
  theme: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="bg-ctp-crust rounded-xl p-4 px-6 mb-8 flex items-center justify-between">
      <code className="text-sm select-all">
        stellar apply {author}/{theme}
      </code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(
            `stellar apply ${author}/${theme}`,
          );
          setCopied(true);
          setTimeout(() => setCopied(false), 5000); // revert after 5s
        }}
        type="button"
        className="ml-4 p-2 rounded bg-ctp-surface0 flex items-center justify-center cursor-pointer ring-1 ring-offset-2 ring-ctp-surface0 ring-offset-ctp-crust"
      >
        {copied ? (
          <Check className="w-4 h-4 text-ctp-green" />
        ) : (
          <Copy className="w-4 h-4 text-ctp-text" />
        )}
      </button>
    </div>
  );
}
