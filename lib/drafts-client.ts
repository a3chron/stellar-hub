// Fetch helpers for the upload wizard and the settings drafts list. Every
// draft route answers errors as `{ error, code?, details? }`; anything else
// (a proxy's 413 or 504 page) is turned into the same shape here so callers
// only ever handle one kind of failure.
import type { ApiErrorBody } from "@/lib/draft-shared";

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiErrorBody };

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    return {
      ok: false,
      status: 0,
      error: {
        error:
          "Could not reach the server - check your connection and try again.",
        code: "network",
      },
    };
  }

  if (response.status === 204) {
    return { ok: true, status: 204, data: undefined as T };
  }

  const body = await response.json().catch(() => null);
  if (response.ok && body !== null) {
    return { ok: true, status: response.status, data: body as T };
  }
  // Our own errors carry a message worth showing - except a server error,
  // whose "Internal server error" says nothing useful.
  if (body && typeof body.error === "string" && response.status < 500) {
    return { ok: false, status: response.status, error: body };
  }
  if (response.status === 413) {
    return {
      ok: false,
      status: 413,
      error: {
        error: "That screenshot is too large - keep it under 4MB.",
        code: "invalid_screenshot",
      },
    };
  }
  // A server error, or a proxy page instead of one of our JSON errors.
  const error =
    response.status >= 500
      ? `Something went wrong on our side (${response.status}) - please try again in a moment.`
      : `Something went wrong (${response.status}) - please try again.`;
  return { ok: false, status: response.status, error: { error } };
}

export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** `details.code` of a `draft_exists` error. */
export function existingDraftCode(error: ApiErrorBody): string | null {
  if (error.code !== "draft_exists") {
    return null;
  }
  const details = error.details as { code?: unknown } | undefined;
  return typeof details?.code === "string" ? details.code : null;
}
