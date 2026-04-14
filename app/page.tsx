import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeroVideo } from "@/components/hero-video";
import { ThemeFiltersWrapper } from "@/components/home/theme-filters-wrapper";
import { ThemeGridWrapper } from "@/components/home/theme-grid-wrapper";
import InstallIntruction from "@/components/install-intruction";
import { FiltersSkeleton } from "@/components/skeletons/filters-skeleton";
import { ThemeGridSkeleton } from "@/components/skeletons/theme-grid-skeleton";
import type { colorModeEnum } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Stellar - Beautiful Starship Themes",
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

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const sort = (params.sort as string) || "downloads";
  const colorSchemeId = params.colorScheme as string | undefined;
  const colorMode = params.colorMode as
    | (typeof colorModeEnum.enumValues)[number]
    | undefined;
  const page = Math.max(1, parseInt((params.page as string) || "1"));

  // Create a unique key for the Suspense boundary based on filter params
  // This ensures React re-renders the suspense boundary when filters change
  const gridKey = `${sort}-${colorSchemeId || ""}-${colorMode || ""}-${page}`;

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
            <InstallIntruction />
            <Link
              href={"/upload"}
              className="p-4 px-6 rounded-xl border-2 border-ctp-crust bg-ctp-mantle text-lg font-medium transition hover:ring-2 hover:ring-ctp-surface0 ring-offset-4 ring-offset-ctp-base"
            >
              Publish your theme
            </Link>
          </div>
        </div>
        <div className="relative z-10">
          <HeroVideo />
        </div>
      </section>

      {/* Themes Section */}
      <section>
        <h2 className="text-3xl font-semibold mb-6">{getSortTitle(sort)}</h2>

        <Suspense fallback={<FiltersSkeleton />}>
          <ThemeFiltersWrapper />
        </Suspense>

        <Suspense key={gridKey} fallback={<ThemeGridSkeleton />}>
          <ThemeGridWrapper
            sort={sort}
            colorSchemeId={colorSchemeId}
            colorMode={colorMode}
            page={page}
          />
        </Suspense>
      </section>
    </main>
  );
}
