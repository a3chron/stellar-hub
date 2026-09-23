import type { CSSProperties } from "react";
import type { TomlLineTokens } from "./highlighter";

/**
 * Renders one line of TOML: a token per `<span>` with its `htmlStyle`
 * (`--shiki-light`/`--shiki-dark` custom properties) applied, so color comes
 * from the `.shiki`/`.shiki span` rules in app/globals.css rather than being
 * hardcoded here. Falls back to the raw line text when tokens aren't ready
 * yet (or highlighting failed) - the line still renders, just unstyled.
 *
 * Tokens are recomputed for the *whole* value only once tokenizing resolves
 * (see useTomlTokens), so right after an edit the tokens passed in here can
 * still describe the line's previous text - trusting them at face value
 * would flash the old content back under the caret for a frame. Comparing
 * what the tokens actually spell out against the line's live text catches
 * that: a stale line falls back to plain text (still correct, just
 * momentarily uncolored) instead of visibly showing content that isn't
 * there anymore, and every line that hasn't changed keeps its color with no
 * flicker at all.
 */
export function TomlLineContent({
  text,
  tokens,
}: {
  text: string;
  tokens: TomlLineTokens | undefined;
}) {
  // Configs uploaded from Windows keep their CRLF endings, so a line split on
  // "\n" still ends in "\r" - which shiki's tokens never include. Compare
  // without it, or every line of such a config would count as stale.
  const lineText = text.endsWith("\r") ? text.slice(0, -1) : text;
  if (!tokens || tokens.map((token) => token.content).join("") !== lineText) {
    return <>{text}</>;
  }

  return (
    <>
      {tokens.map((token, index) => (
        // Tokens don't carry a stable id and re-tokenize as a whole on every
        // change, so index is fine here.
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens are recreated wholesale per render
        <span key={index} style={token.htmlStyle as CSSProperties}>
          {token.content}
        </span>
      ))}
    </>
  );
}
