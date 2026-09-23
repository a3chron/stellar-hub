// Client-side TOML tokenizer, built from Shiki's fine-grained bundle instead
// of the full `shiki` package: only the TOML grammar, the two Catppuccin
// themes the docs already use (see components/docs/code-block.tsx), the
// JavaScript regex engine (no oniguruma/wasm), and `shiki/core` itself are
// loaded, and all of it only once the first component actually asks for
// tokens - `import type` below costs nothing at runtime, and every value
// import is dynamic, so no Shiki code ships in the initial bundle just
// because this module was imported.
//
// `flatTokenVariants` mirrors what `codeToHtml({ themes: {...}, defaultColor:
// false })` does under the hood: it turns a token's per-theme colors into a
// single `htmlStyle` object keyed by `--shiki-light` / `--shiki-dark` (plus
// the `-font-style` variants for italics). Those are exactly the custom
// properties app/globals.css already switches on `prefers-color-scheme`, so
// tokens rendered from here pick up the site's light/dark handling for free -
// no extra CSS needed beyond adding the `shiki` class to a wrapper element.
import type { HighlighterCore, ThemedToken } from "shiki/core";

export type TomlLineTokens = ThemedToken[];

const THEMES = { light: "catppuccin-latte", dark: "catppuccin-mocha" } as const;

let highlighterPromise: Promise<HighlighterCore> | null = null;
let flatTokenVariantsPromise: Promise<
  typeof import("shiki/core").flatTokenVariants
> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
      createHighlighterCore({
        langs: [import("shiki/langs/toml.mjs")],
        themes: [
          import("shiki/themes/catppuccin-latte.mjs"),
          import("shiki/themes/catppuccin-mocha.mjs"),
        ],
        engine: createJavaScriptRegexEngine(),
      }),
    );
  }
  return highlighterPromise;
}

function getFlatTokenVariants() {
  if (!flatTokenVariantsPromise) {
    flatTokenVariantsPromise = import("shiki/core").then(
      (core) => core.flatTokenVariants,
    );
  }
  return flatTokenVariantsPromise;
}

/**
 * Tokenizes a TOML string into one token array per line, each token already
 * carrying its resolved `htmlStyle` (light + dark css vars). Rejects only if
 * the grammar/theme/core modules themselves fail to load - callers should
 * treat that the same as "not ready yet" and fall back to plain text.
 */
export async function tokenizeToml(code: string): Promise<TomlLineTokens[]> {
  const [highlighter, flatTokenVariants] = await Promise.all([
    getHighlighter(),
    getFlatTokenVariants(),
  ]);
  const lines = highlighter.codeToTokensWithThemes(code, {
    lang: "toml",
    themes: THEMES,
  });

  return lines.map((line) =>
    line.map((token) =>
      flatTokenVariants(token, ["light", "dark"], "--shiki-", false),
    ),
  );
}
