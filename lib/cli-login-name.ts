// Names of CLI logins. Free of server imports: the approval page and the
// settings list use these too.
import { isSingleLineSafe, SINGLE_LINE_MESSAGE } from "@/lib/text-rules";

export const CLI_LOGIN_NAME_MAX_LENGTH = 50;

/** What a login request stores when the CLI didn't say who it is. */
export const UNKNOWN_CLIENT = "unknown client";

// The User-Agent shape stellar-cli sends; anything else is stored as
// UNKNOWN_CLIENT rather than shown verbatim on the approval page.
export const CLIENT_PATTERN =
  /^stellar-cli\/[0-9A-Za-z.+-]+ \((linux|darwin|windows); (amd64|arm64)\)$/;

const OS_NAMES: Record<string, string> = {
  linux: "Linux",
  darwin: "macOS",
  windows: "Windows",
};

/**
 * The name a login gets unless its owner picks another one:
 * "stellar-cli/1.7.0 (linux; amd64)" -> "Linux · amd64", anything else ->
 * "CLI login".
 */
export function defaultLoginName(client: string): string {
  const match = client.match(CLIENT_PATTERN);
  if (!match) {
    return "CLI login";
  }
  return `${OS_NAMES[match[1]]} · ${match[2]}`;
}

/**
 * The name to show for a login. Logins from before names existed still
 * carry the raw client string as their label; they get the default name.
 */
export function displayLoginName(label: string): string {
  if (label === UNKNOWN_CLIENT || CLIENT_PATTERN.test(label)) {
    return defaultLoginName(label);
  }
  return label;
}

export type LoginNameCheck =
  | { ok: true; name: string }
  | { ok: false; error: string };

/** Trimmed, 1-50 characters, single-line safe. */
export function checkLoginName(raw: string): LoginNameCheck {
  const name = raw.trim();
  if (name === "") {
    return { ok: false, error: "can't be empty" };
  }
  if (name.length > CLI_LOGIN_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `must be ${CLI_LOGIN_NAME_MAX_LENGTH} characters or less`,
    };
  }
  if (!isSingleLineSafe(name)) {
    return { ok: false, error: SINGLE_LINE_MESSAGE };
  }
  return { ok: true, name };
}
