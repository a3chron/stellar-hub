import { isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cliInstalls, themes } from "@/lib/db/schema";

/**
 * GET /api/stats
 *
 * Public, read by the chronogrid dashboard. `totalDownloads` is the original
 * field and keeps its exact shape (it arrives as a STRING through the Supabase
 * pooler, and the consumer coerces it — do not "fix" that here without
 * changing the consumer). The `cli` block is newer and carries numbers, cast
 * with `::int` in SQL and `Number()` here because of that same pooler quirk.
 */

type Bucket = { active: number; uninstalled: number };

export type CliStats = {
  installs: { clean: Bucket; existing: Bucket };
  /** Version changes seen across every install (updates and re-installs). */
  updates: number;
  /** Active installs only, most common first. */
  byVersion: { version: string; count: number }[];
  /** Active installs only. */
  byOs: { linux: number; darwin: number; windows: number };
  /** When the first install reported, or null before any did. */
  since: string | null;
};

export async function GET() {
  try {
    const result = await db
      .select({
        totalDownloads: sql<number>`COALESCE(SUM(${themes.downloads}), 0)`,
      })
      .from(themes);

    return NextResponse.json({
      totalDownloads: result[0].totalDownloads,
      cli: await cliStats(),
    });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}

/**
 * Own try/catch on purpose: until the cli_installs migration has run in
 * production this query fails, and that must degrade to `cli: null` rather
 * than take `totalDownloads` down with it.
 */
async function cliStats(): Promise<CliStats | null> {
  try {
    const [byKind, byVersion, byOs, totals] = await Promise.all([
      db
        .select({
          kind: cliInstalls.kind,
          // 1/0 rather than a boolean: the pooler returns booleans as "t"/"f".
          active: sql<number>`(${cliInstalls.uninstalledAt} IS NULL)::int`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(cliInstalls)
        .groupBy(
          cliInstalls.kind,
          sql`(${cliInstalls.uninstalledAt} IS NULL)::int`,
        ),
      db
        .select({
          version: cliInstalls.version,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(cliInstalls)
        .where(isNull(cliInstalls.uninstalledAt))
        .groupBy(cliInstalls.version)
        .orderBy(sql`COUNT(*) DESC`, cliInstalls.version),
      db
        .select({
          os: cliInstalls.os,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(cliInstalls)
        .where(isNull(cliInstalls.uninstalledAt))
        .groupBy(cliInstalls.os),
      db
        .select({
          updates: sql<number>`COALESCE(SUM(${cliInstalls.updates}), 0)::int`,
          since: sql<string | null>`MIN(${cliInstalls.firstSeenAt})`,
        })
        .from(cliInstalls),
    ]);

    const installs = {
      clean: { active: 0, uninstalled: 0 },
      existing: { active: 0, uninstalled: 0 },
    };
    for (const row of byKind) {
      const bucket =
        row.kind === "install" ? installs.clean : installs.existing;
      if (Number(row.active) === 1) {
        bucket.active += Number(row.count);
      } else {
        bucket.uninstalled += Number(row.count);
      }
    }

    const osCounts = { linux: 0, darwin: 0, windows: 0 };
    for (const row of byOs) {
      if (row.os === "linux" || row.os === "darwin" || row.os === "windows") {
        osCounts[row.os] += Number(row.count);
      }
    }

    const since = totals[0]?.since;

    return {
      installs,
      updates: Number(totals[0]?.updates ?? 0),
      byVersion: byVersion.map((r) => ({
        version: r.version,
        count: Number(r.count),
      })),
      byOs: osCounts,
      since: since ? new Date(since).toISOString() : null,
    };
  } catch (error) {
    console.error("Failed to fetch CLI install stats:", error);
    return null;
  }
}
