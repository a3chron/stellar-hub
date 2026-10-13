// Text rules shared by the server's validation and the forms that mirror it.
// Free of server imports so client components can use them.

// Single-line text (names, groups, dependencies, CLI login names) may hold
// neither control characters nor the bidi and invisible formatting marks
// that make text render differently from what it is - a name that reads
// "ctp-blue" on the page but is something else underneath. Written with
// escapes on purpose: the marks themselves would be invisible in the source.
const SINGLE_LINE_FORBIDDEN =
  /[\p{Cc}\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/u;

export const SINGLE_LINE_MESSAGE =
  "must not contain control characters or invisible text-direction marks";

export function isSingleLineSafe(value: string): boolean {
  return !SINGLE_LINE_FORBIDDEN.test(value);
}
