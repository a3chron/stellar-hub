// Small browser-side hints for the auth pages. Nothing server-side reads any
// of this, and blocked or cleared storage just means the hint is missing.

// Which way this browser last signed in, so the login page can mark it.

const KEY = "stellar:last-login-method";

export type LoginMethod = "github" | "gitlab" | "google" | "email";

export function getLastLoginMethod(): LoginMethod | null {
  try {
    const value = localStorage.getItem(KEY);
    if (
      value === "github" ||
      value === "gitlab" ||
      value === "google" ||
      value === "email"
    ) {
      return value;
    }
  } catch {
    // Storage unavailable (private mode, blocked site data).
  }
  return null;
}

export function rememberLoginMethod(method: LoginMethod) {
  try {
    localStorage.setItem(KEY, method);
  } catch {
    // Storage unavailable - the marker is a nicety, not worth failing over.
  }
}

// The address typed on the login page, carried over to /forgot-password so it
// doesn't have to be entered twice. sessionStorage rather than a query param
// keeps the email out of the URL, history and access logs.
const RESET_EMAIL_KEY = "stellar:reset-email";

export function stashResetEmail(email: string) {
  try {
    sessionStorage.setItem(RESET_EMAIL_KEY, email);
  } catch {
    // Storage unavailable - they just type it again.
  }
}

export function takeResetEmail(): string | null {
  try {
    const email = sessionStorage.getItem(RESET_EMAIL_KEY);
    sessionStorage.removeItem(RESET_EMAIL_KEY);
    return email;
  } catch {
    return null;
  }
}
