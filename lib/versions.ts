// Theme version rules, shared by the drafts API, publishing and the wizard.
//
// Versions are two numeric segments ("1.0", "2.13"). The first is bumped for
// new features ("minor" in the UI), the second for small fixes ("patch") -
// breaking redesigns are meant to be a new theme instead.

/** The only accepted shape: no leading zeros, no `v`, exactly two segments. */
export const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function segments(version: string): number[] {
  return version.split(".").map((part) => {
    const value = Number.parseInt(part, 10);
    return Number.isNaN(value) ? 0 : value;
  });
}

/**
 * Numeric, per-segment comparison: 1.10 is newer than 1.9, which a string
 * compare (or ordering by createdAt) gets wrong. Negative when `a` is older,
 * positive when it is newer, 0 when equal.
 */
export function compareVersions(a: string, b: string): number {
  const left = segments(a);
  const right = segments(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

/** The numerically newest entry - what "latest" means everywhere. */
export function pickLatestVersion<T extends { version: string }>(
  versions: T[],
): T | undefined {
  let latest: T | undefined;
  for (const candidate of versions) {
    if (!latest || compareVersions(candidate.version, latest.version) > 0) {
      latest = candidate;
    }
  }
  return latest;
}

/** minor: 1.3 -> 2.0, patch: 1.3 -> 1.4. */
export function calculateNextVersion(
  current: string,
  type: "minor" | "patch",
): string {
  const [minor = 0, patch = 0] = segments(current);

  if (type === "minor") {
    return `${minor + 1}.0`;
  }
  return `${minor}.${patch + 1}`;
}

/** Newest first by version number - the order every versions list uses. */
export function sortVersionsDesc<T extends { version: string }>(
  versions: T[],
): T[] {
  return [...versions].sort((a, b) => compareVersions(b.version, a.version));
}
