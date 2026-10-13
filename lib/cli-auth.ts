import { createHash, randomBytes, randomInt } from "node:crypto";

// Secrets and short codes for the CLI device login and for drafts.
//
// The alphabet leaves out 0/O, 1/I/L-lookalikes and lowercase, so a code can
// be read off a terminal and typed back without guessing.
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const CLI_AUTH_EXPIRES_IN_SECONDS = 600;
export const CLI_AUTH_INTERVAL_SECONDS = 3;
// Pending (undecided, unexpired) requests allowed per network at once.
export const CLI_AUTH_MAX_PENDING_PER_IP = 5;
// Pending requests allowed in total, whoever started them.
export const CLI_AUTH_MAX_PENDING_TOTAL = 500;

// The User-Agent shape the CLI sends; anything else is labelled as unknown
// rather than shown verbatim on the approval page.
const CLIENT_PATTERN =
  /^stellar-cli\/[0-9A-Za-z.+-]+ \((linux|darwin|windows); (amd64|arm64)\)$/;

export function randomCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** SHA-256 (hex). Device codes and tokens are only ever stored like this. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateDeviceCode(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCliToken(): string {
  return `stl_${randomBytes(32).toString("base64url")}`;
}

/**
 * Accepts the user code however it was typed ("wdjb-mjht", "WDJB MJHT") and
 * returns the stored form, or null when it can't be one.
 */
export function normalizeUserCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (code.length !== 8 || [...code].some((c) => !CODE_ALPHABET.includes(c))) {
    return null;
  }
  return code;
}

/** "WDJBMJHT" -> "WDJB-MJHT", as shown in the terminal and on the page. */
export function formatUserCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function parseClientLabel(client: unknown): string {
  return typeof client === "string" && CLIENT_PATTERN.test(client)
    ? client
    : "unknown client";
}
