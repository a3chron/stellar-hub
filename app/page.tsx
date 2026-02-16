import { and, desc, eq, gt, type SQL, sql } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import InstallIntruction from "@/components/install-intruction";
import Pagination from "@/components/pagination";
import ThemeCard from "@/components/theme-card";
import ThemeFilters from "@/components/theme-filters";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const sort = (params.sort as string) || "downloads";
  const colorSchemeId = params.colorScheme as string;
  const page = Math.max(1, parseInt((params.page as string) || "1"));
  const limit = 12;
  const offset = (page - 1) * limit;

  // Get all color schemes for filter
  const colorSchemes = await db.query.colorSchemes.findMany({
    orderBy: (colorSchemes, { asc }) => [asc(colorSchemes.name)],
  });

  // Build where clause for color scheme filter
  const whereConditions = [];
  if (colorSchemeId) {
    whereConditions.push(eq(themes.colorSchemeId, colorSchemeId));
  }

  // Determine order by based on sort parameter
  let orderBy: SQL[];
  if (sort === "latest") {
    orderBy = [desc(themes.createdAt)];
  } else if (sort === "trending") {
    // Trending: themes created in last month, sorted by downloads
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    whereConditions.push(gt(themes.createdAt, oneMonthAgo));
    orderBy = [desc(themes.downloads), desc(themes.createdAt)];
  } else {
    // Default: most downloads
    orderBy = [desc(themes.downloads)];
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // Get total count for pagination
  const totalCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(themes)
    .where(whereClause);
  const totalCount = Number(totalCountResult[0]?.count || 0);
  const totalPages = Math.ceil(totalCount / limit);

  const displayedThemes = await db.query.themes.findMany({
    where: whereClause,
    orderBy,
    limit,
    offset,
    with: {
      author: true,
      colorScheme: true,
    },
  });

  return (
    <main className="container mx-auto px-4 py-12">
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
          <Image
            src={"/demo.gif"}
            unoptimized
            width={600}
            height={400}
            alt="Demo Gif"
            className="rounded-3xl md:absolute top-0 z-10 border-2 border-ctp-surface2"
          />
          <div className="rotate-5 bg-ctp-surface0 rounded-3xl w-[600px] h-[400px] hidden md:block" />
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-semibold mb-6">
          {(() => {
            switch (sort) {
              case "latest":
                return "Latest Themes";
              case "trending":
                return "Trending Themes";
              default:
                return "Popular Themes";
            }
          })()}
        </h2>

        <ThemeFilters colorSchemes={colorSchemes} />

        {displayedThemes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {displayedThemes.map((theme) => (
                <ThemeCard key={theme.id} theme={theme} />
              ))}
            </div>
            <Pagination currentPage={page} totalPages={totalPages} />
          </>
        ) : (
          <div className="text-center py-12 text-ctp-subtext0">
            <p>No themes found with the selected filters.</p>
          </div>
        )}
      </section>
    </main>
  );
}
