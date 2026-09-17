import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { cliInstalls } from "@/lib/db/schema";
import { pingRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/cli/ping
 *
 * The stellar CLI's anonymous install report. It fires on first run, after a
 * version change and on uninstall — not on a timer — and carries exactly the
 * fields below. Nothing else about the request is kept: no IP (the rate limit
 * is keyed by the install id, so even its hash is never needed), no headers.
 *
 * The CLI retries a failed report on its next run, so every event is an
 * upsert and a repeat is harmless.
 */

const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

const pingSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["install", "existing"]),
  event: z.enum(["report", "uninstall"]),
  version: z.string().regex(VERSION, "version must be semver without a v"),
  previous: z.union([z.literal(""), z.string().regex(VERSION)]),
  os: z.enum(["linux", "darwin", "windows"]),
  arch: z.enum(["amd64", "arm64"]),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = pingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid ping", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const ping = parsed.data;

    // Keyed by install id, not IP: a machine reports a handful of times over
    // its whole life, so anything chattier than that is a bug or a script.
    const rateLimit = pingRateLimiter.check(ping.id);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        },
      );
    }

    if (ping.event === "uninstall") {
      // A tombstone is inserted for an unknown id so an uninstall can never
      // push the active count below what was actually reported.
      await db
        .insert(cliInstalls)
        .values({
          id: ping.id,
          kind: ping.kind,
          os: ping.os,
          arch: ping.arch,
          firstVersion: ping.version,
          version: ping.version,
          uninstalledAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: cliInstalls.id,
          set: {
            lastSeenAt: sql`now()`,
            uninstalledAt: sql`now()`,
          },
        });
    } else {
      // `updates` counts version CHANGES, compared SQL-side against the stored
      // row so a retried report of the same version does not inflate it.
      // `uninstalled_at` is cleared because a report from a known id means the
      // install is back (a reinstall that kept its config).
      await db
        .insert(cliInstalls)
        .values({
          id: ping.id,
          kind: ping.kind,
          os: ping.os,
          arch: ping.arch,
          firstVersion: ping.version,
          version: ping.version,
        })
        .onConflictDoUpdate({
          target: cliInstalls.id,
          set: {
            version: ping.version,
            os: ping.os,
            arch: ping.arch,
            lastSeenAt: sql`now()`,
            updates: sql`${cliInstalls.updates} + (CASE WHEN ${cliInstalls.version} <> ${ping.version} THEN 1 ELSE 0 END)`,
            uninstalledAt: null,
          },
        });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("CLI ping error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
