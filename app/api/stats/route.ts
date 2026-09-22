import { isNotNull, isNull, sql } from "drizzle-orm";
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
  /**
   * Active installs only, cross-tabbed by (version, os) — the real cross-tab,
   * not something recoverable by joining `byVersion` and `byOs`. `os` is
   * "unknown" for the pre-arch/os rows that predate the column being
   * populated, rather than being dropped.
   */
  byVersionOs: { version: string; os: string; count: number }[];
  /**
   * Active installs only, keyed by arch. "unknown" covers rows from before
   * `arch` was reported (the column is nullable for that reason).
   */
  byArch: { amd64: number; arm64: number; unknown: number };
  /**
   * ALL installs (live and uninstalled), grouped by the version they first
   * installed as — not the version they currently run. Unlike `byVersion`
   * this does not decay as people upgrade, so it is the honest per-release
   * attribution the Releases panel should use.
   */
  byFirstVersion: { version: string; count: number }[];
  /**
   * ALL installs, grouped by the UTC calendar day of `first_seen_at`
   * (`YYYY-MM-DD`), ordered chronologically. An install still counts here
   * even if it was later uninstalled.
   */
  installsByDay: { day: string; count: number }[];
  /**
   * Only rows with a non-null `uninstalled_at`, grouped by its UTC calendar
   * day (`YYYY-MM-DD`), ordered chronologically.
   */
  uninstallsByDay: { day: string; count: number }[];
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
    const [
      byKind,
      byVersion,
      byOs,
      byVersionOsRows,
      byArchRows,
      byFirstVersionRows,
      installsByDayRows,
      uninstallsByDayRows,
      totals,
    ] = await Promise.all([
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
      // Real cross-tab of version x os, active installs only — matches the
      // `byVersion`/`byOs` marginals it complements, so the three stay
      // mutually consistent.
      db
        .select({
          version: cliInstalls.version,
          os: cliInstalls.os,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(cliInstalls)
        .where(isNull(cliInstalls.uninstalledAt))
        .groupBy(cliInstalls.version, cliInstalls.os)
        .orderBy(sql`COUNT(*) DESC`, cliInstalls.version),
      // Active installs only, same treatment as byOs.
      db
        .select({
          arch: cliInstalls.arch,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(cliInstalls)
        .where(isNull(cliInstalls.uninstalledAt))
        .groupBy(cliInstalls.arch),
      // ALL installs (no uninstalledAt filter), grouped by the version they
      // FIRST installed as — deliberately does not decay as installs upgrade
      // or get removed, unlike byVersion.
      db
        .select({
          version: cliInstalls.firstVersion,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(cliInstalls)
        .groupBy(cliInstalls.firstVersion)
        .orderBy(sql`COUNT(*) DESC`, cliInstalls.firstVersion),
      // ALL installs, by calendar day of first_seen_at.
      db
        .select({
          day: sql<string>`to_char(date(${cliInstalls.firstSeenAt}), 'YYYY-MM-DD')`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(cliInstalls)
        .groupBy(sql`date(${cliInstalls.firstSeenAt})`)
        .orderBy(sql`date(${cliInstalls.firstSeenAt})`),
      // Only rows that have actually been uninstalled, by calendar day of
      // uninstalled_at.
      db
        .select({
          day: sql<string>`to_char(date(${cliInstalls.uninstalledAt}), 'YYYY-MM-DD')`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(cliInstalls)
        .where(isNotNull(cliInstalls.uninstalledAt))
        .groupBy(sql`date(${cliInstalls.uninstalledAt})`)
        .orderBy(sql`date(${cliInstalls.uninstalledAt})`),
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

    const byVersionOs = byVersionOsRows.map((r) => ({
      version: r.version,
      os: r.os ?? "unknown",
      count: Number(r.count),
    }));

    const archCounts = { amd64: 0, arm64: 0, unknown: 0 };
    for (const row of byArchRows) {
      if (row.arch === "amd64" || row.arch === "arm64") {
        archCounts[row.arch] += Number(row.count);
      } else {
        archCounts.unknown += Number(row.count);
      }
    }

    const byFirstVersion = byFirstVersionRows.map((r) => ({
      version: r.version,
      count: Number(r.count),
    }));

    const installsByDay = installsByDayRows.map((r) => ({
      day: r.day,
      count: Number(r.count),
    }));

    const uninstallsByDay = uninstallsByDayRows.map((r) => ({
      day: r.day,
      count: Number(r.count),
    }));

    const since = totals[0]?.since;

    return {
      installs,
      updates: Number(totals[0]?.updates ?? 0),
      byVersion: byVersion.map((r) => ({
        version: r.version,
        count: Number(r.count),
      })),
      byOs: osCounts,
      byVersionOs,
      byArch: archCounts,
      byFirstVersion,
      installsByDay,
      uninstallsByDay,
      since: since ? new Date(since).toISOString() : null,
    };
  } catch (error) {
    console.error("Failed to fetch CLI install stats:", error);
    return null;
  }
}
