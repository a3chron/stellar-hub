// The authoritative "does this theme run shell code" check.
//
// Deliberately its own module: it pulls in a TOML parser, and the only other
// consumer of lib/toml-custom-sections.ts is the preview modal, which is a
// client component. Keeping them separate means the parser never ships to the
// browser and never runs on a client render.
//
// Server-side only - the two API routes that flag a theme, and the theme page
// that decides which versions get a warning icon.
import { parse as parseToml } from "smol-toml";

/**
 * Whether a config defines any custom command at all.
 *
 * The single source of truth for that question across the app - the shield
 * icon on the versions list and the red banner in the preview both call this.
 *
 * Decoded with a real TOML parser rather than the scanner above, and checked
 * the same way the CLI checks it: a non-empty top-level `custom` table
 * (stellar-cli/internal/theme/validator.go). That equivalence is the point -
 * the CLI refuses to apply the theme and sends the user to this page, so a
 * page that disagreed would tell them a dangerous config is clean.
 */
export function hasCustomSections(configContent: string): boolean {
  try {
    const decoded = parseToml(configContent) as Record<string, unknown>;
    const custom = decoded.custom;
    return (
      typeof custom === "object" &&
      custom !== null &&
      Object.keys(custom).length > 0
    );
  } catch {
    // Fail closed. Not "fall back to the scanner": the scanner only sees
    // `[custom.*]` headers, so it is blind to `custom.x = …` and
    // `custom = { … }`, and this branch is reachable for configs that are
    // perfectly valid to the CLI. smol-toml is stricter than Go BurntSushi in
    // at least three ways - it rejects any integer above 2^53 (legal i64,
    // which starship loads fine), and it rejects two table/inline-table
    // redefinitions that BurntSushi accepts. An author can therefore trigger
    // this branch on purpose and, with the command hidden in an inline table,
    // get a "clean" verdict out of the scanner.
    //
    // Over-warning on a config we cannot read costs nothing: the CLI refuses
    // to apply it anyway, so the warning is never wrong in a way that hurts.
    return true;
  }
}
