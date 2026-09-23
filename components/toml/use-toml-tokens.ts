"use client";

import { useEffect, useState } from "react";
import { type TomlLineTokens, tokenizeToml } from "./highlighter";

// Coalesces bursts of fast typing into one tokenize call instead of
// re-running Shiki (a synchronous, CPU-bound pass over the whole config)
// after every keystroke - the cost that matters for a large config, not the
// occasional single edit.
const DEBOUNCE_MS = 150;

/**
 * Tokenizes `code` for TOML syntax highlighting off the render's critical
 * path. Shiki's grammar/theme modules load lazily on first use, so this
 * returns `null` until the first tokenize resolves; callers should render
 * plain text while it's `null` rather than block on it - nothing here ever
 * throws into the caller.
 *
 * Deliberately does *not* reset to `null` while a re-tokenize is pending -
 * that would flash every line back to plain text on each keystroke before
 * the new tokens arrive. Instead this keeps returning the previous result
 * until the next one resolves, and leans on TomlLineContent (toml-line.tsx)
 * to compare each line's tokens against its current text and fall back to
 * plain text only for the line(s) that actually changed.
 */
export function useTomlTokens(code: string): TomlLineTokens[] | null {
  const [tokens, setTokens] = useState<TomlLineTokens[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      tokenizeToml(code)
        .then((result) => {
          if (!cancelled) setTokens(result);
        })
        .catch(() => {
          // Grammar/theme failed to load (offline, blocked CDN, etc.) - keep
          // whatever tokens are already shown rather than surface an error;
          // TomlLineContent's own staleness check falls back to plain text
          // for any line they no longer match.
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code]);

  return tokens;
}
