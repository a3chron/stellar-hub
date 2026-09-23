import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeroVideo } from "@/components/hero-video";
import { ThemeFiltersWrapper } from "@/components/home/theme-filters-wrapper";
import { ThemeGridWrapper } from "@/components/home/theme-grid-wrapper";
import AsteriskLogo from "@/components/icons/asterisk";
import { FiltersSkeleton } from "@/components/skeletons/filters-skeleton";
import { ThemeGridSkeleton } from "@/components/skeletons/theme-grid-skeleton";
import type { colorModeEnum } from "@/lib/db/schema";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/theme-search";

export const metadata: Metadata = {
  // Absolute: bypasses the root layout's `%s - Stellar` template so this
  // doesn't render as "Stellar - Beautiful Starship Themes - Stellar".
  title: { absolute: "Stellar - Beautiful Starship Themes" },
  description:
    "Discover and install beautiful Starship shell prompt themes with a single command. Browse community-created themes and customize your terminal.",
  openGraph: {
    title: "Stellar - Beautiful Starship Themes",
    description:
      "Discover and install beautiful Starship shell prompt themes with a single command.",
    type: "website",
  },
};

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getSortTitle(sort: string): string {
  switch (sort) {
    case "latest":
      return "Latest Themes";
    case "trending":
      return "Trending Themes";
    default:
      return "Popular Themes";
  }
}

// A search takes over the section heading regardless of the current sort -
// "Results for ..." is what tells the visitor their query is what narrowed
// the list.
function getSectionTitle(sort: string, q?: string): string {
  if (q) {
    return `Results for "${q}"`;
  }
  return getSortTitle(sort);
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const sort = (params.sort as string) || "downloads";
  const colorSchemeId = params.colorScheme as string | undefined;
  const colorMode = params.colorMode as
    | (typeof colorModeEnum.enumValues)[number]
    | undefined;
  // `?q=a&q=b` parses as string[], and a bare `as string` cast doesn't catch
  // that at runtime - it reaches escapeLike()'s `.replace` (via
  // buildThemeSearchCondition) as an array, which has no such method and
  // 500s the page. Take the first value, and cap its length the same way the
  // quick-search API does so a huge query isn't wasted work either.
  const rawQ = Array.isArray(params.q) ? params.q[0] : params.q;
  const q = rawQ?.trim().slice(0, MAX_SEARCH_QUERY_LENGTH) || undefined;
  const page = Math.max(1, parseInt((params.page as string) || "1"));

  // Create a unique key for the Suspense boundary based on filter params
  // This ensures React re-renders the suspense boundary when filters change
  const gridKey = `${sort}-${colorSchemeId || ""}-${colorMode || ""}-${q || ""}-${page}`;

  return (
    <main className="container mx-auto px-4 py-12">
      {/* Hero Section - renders immediately */}
      <section className="mb-16 flex flex-col md:flex-row gap-16 justify-between">
        <div className="mt-10">
          <h1 className="text-5xl font-bold mb-4">stellar</h1>
          <p className="text-xl text-ctp-subtext0">
            Beautiful Starship themes, one command away
          </p>
          <div className="flex flex-wrap mt-8 gap-10 md:gap-6">
            <Link
              href="/docs/installing"
              className="p-4 px-8 rounded-xl border-2 border-ctp-text bg-ctp-text text-lg font-medium text-ctp-base transition hover:ring-2 hover:ring-ctp-surface1 ring-offset-4 ring-offset-ctp-base inline-flex items-center gap-2.5"
            >
              {/* Decorative: the label already says "stellar", and the
                  component carries its own <title>. */}
              <AsteriskLogo width={28} height={28} aria-hidden="true" />
              Install stellar
            </Link>
            <Link
              href={"/upload"}
              className="p-4 px-6 rounded-xl border-2 border-ctp-crust bg-ctp-mantle text-lg font-medium transition hover:ring-2 hover:ring-ctp-surface0 ring-offset-4 ring-offset-ctp-base"
            >
              Publish your theme
            </Link>
          </div>
        </div>
        <div className="relative z-10 w-full md:w-auto">
          <HeroVideo />
        </div>
      </section>

      {/* Themes Section */}
      <section id="themes" className="scroll-mt-24">
        <h2 className="text-3xl font-semibold mb-6">
          {getSectionTitle(sort, q)}
        </h2>

        <Suspense fallback={<FiltersSkeleton />}>
          <ThemeFiltersWrapper />
        </Suspense>

        <Suspense key={gridKey} fallback={<ThemeGridSkeleton />}>
          <ThemeGridWrapper
            sort={sort}
            colorSchemeId={colorSchemeId}
            colorMode={colorMode}
            q={q}
            page={page}
          />
        </Suspense>
      </section>
    </main>
  );
}
