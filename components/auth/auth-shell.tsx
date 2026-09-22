import Link from "next/link";
import AsteriskLogo from "@/components/icons/asterisk";

const COLUMNS = 28;
const ROWS = 38;
const SPACING = 15;
const WAVE_DURATION_SECONDS = 14;
// How many distinct phases exist. Dots are bucketed into these, so the whole
// field costs this many CSS animations rather than one per dot.
const PHASE_BUCKETS = 26;

/**
 * Where in the cycle a dot sits, from four sine fields at different
 * frequencies and angles.
 *
 * A single sine of x gives vertical bands marching sideways, which reads as
 * mechanical. Summing waves that run along x, y, and both diagonals makes them
 * interfere, so the bright areas are irregular patches that appear, merge and
 * dissolve instead of sweeping past in formation. The constants are arbitrary
 * but deliberately not simple ratios of each other - near-multiples would
 * resynchronise into visible banding.
 */
function phaseAt(x: number, y: number): number {
  const sum =
    Math.sin(x * 0.055) +
    Math.sin(y * 0.041 + 1.7) * 0.8 +
    Math.sin((x + y) * 0.028 + 0.5) * 0.9 +
    Math.sin((x - y) * 0.037 + 2.3) * 0.6;

  // The four amplitudes total 3.3, so this maps into [0, 1).
  return (sum + 3.3) / 6.6;
}

/**
 * A static field of dots with light moving through it in an irregular wave.
 *
 * Nothing moves: each dot only fades between dim and bright. Dots are grouped
 * by phase bucket rather than by position, so ~1000 circles need only 26 CSS
 * animations - the group is an animation carrier, not a layout unit, and its
 * members are scattered across the panel. Group opacity multiplies with each
 * dot's own, so the top-and-bottom falloff survives. CSS-only, so this stays a
 * server component.
 */
function DotWave() {
  const buckets: React.ReactNode[][] = Array.from(
    { length: PHASE_BUCKETS },
    () => [],
  );

  for (let column = 0; column < COLUMNS; column++) {
    for (let row = 0; row < ROWS; row++) {
      const x = column * SPACING + SPACING / 2;
      const y = row * SPACING + SPACING / 2;

      const bucket =
        ((Math.floor(phaseAt(x, y) * PHASE_BUCKETS) % PHASE_BUCKETS) +
          PHASE_BUCKETS) %
        PHASE_BUCKETS;

      // Fade toward the top and bottom so the field dissolves into the panel
      // instead of stopping at a hard edge.
      const depth = 1 - Math.abs(row / (ROWS - 1) - 0.5) * 2;

      buckets[bucket].push(
        <circle
          key={`${column}-${row}`}
          cx={x}
          cy={y}
          r={0.9}
          fill="currentColor"
          opacity={0.12 + depth * 0.5}
        />,
      );
    }
  }

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full text-ctp-surface1"
      viewBox={`0 0 ${COLUMNS * SPACING} ${ROWS * SPACING}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <title>Decorative background</title>
      {buckets.map((dots, bucket) => (
        <g
          key={bucket}
          className="auth-wave-column"
          style={{
            animationDelay: `${(-(bucket / PHASE_BUCKETS) * WAVE_DURATION_SECONDS).toFixed(2)}s`,
          }}
        >
          {dots}
        </g>
      ))}
    </svg>
  );
}

/**
 * The split layout every auth screen sits in: the brand on the left, the thing
 * you actually came to do on the right.
 *
 * On narrow screens the left panel collapses to a short header rather than
 * stacking a full-height decorative panel above the form - on a phone that
 * would push the inputs below the fold.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-ctp-base lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-ctp-crust px-6 py-6 lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <DotWave />
        </div>

        <Link
          href="/"
          className="relative z-10 flex w-fit items-center gap-2 text-lg font-bold text-ctp-text transition-colors hover:text-ctp-lavender"
        >
          <AsteriskLogo width={22} height={22} />
          Stellar
        </Link>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:flex"
        >
          <AsteriskLogo className="text-ctp-text" width={300} height={300} />
        </div>

        {/* Spacer that gives the mark its vertical room on desktop. */}
        <div className="hidden lg:block lg:flex-1" />

        <p className="relative z-10 mt-8 max-w-sm text-sm leading-relaxed text-ctp-subtext0 lg:mt-0">
          Starship prompt themes, one command away.
        </p>
      </section>

      {/* Content panel */}
      <section className="flex items-center justify-center px-6 py-12 lg:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
