import { NextResponse } from "next/server";

/**
 * The error body the CLI-facing routes (/api/cli/auth/**, /api/drafts/**)
 * share: `{ error, code?, details?, missing? }`. The CLI branches on `code`
 * and prints `error`, so `error` is written for a person to read.
 */
export function apiError(
  status: number,
  error: string,
  code?: string,
  extra?: { details?: unknown; missing?: string[] },
) {
  return NextResponse.json({ error, code, ...extra }, { status });
}

/** Unique-index violation from postgres-js, optionally for one constraint. */
export function isUniqueViolation(error: unknown, constraint?: string) {
  // Drizzle may wrap the driver error, so look one level down as well.
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    if (typeof candidate !== "object" || candidate === null) {
      return false;
    }
    const { code, constraint_name } = candidate as {
      code?: string;
      constraint_name?: string;
    };
    return (
      code === "23505" &&
      (constraint === undefined || constraint_name === constraint)
    );
  });
}
