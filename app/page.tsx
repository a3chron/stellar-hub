import { desc } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import InstallIntruction from "@/components/install-intruction";
import ThemeCard from "@/components/theme-card";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";

export default async function HomePage() {
  const trendingThemes = await db.query.themes.findMany({
    orderBy: [desc(themes.downloads)],
    limit: 12,
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
          <p className="text-xl text-text-muted">
            Beautiful Starship themes, one command away
          </p>
          <div className="flex flex-wrap mt-8 gap-6">
            <InstallIntruction />
            <Link
              href={"/upload"}
              className="p-4 px-6 rounded-xl border-2 border-ctp-subtext0 bg-ctp-mantle text-lg font-medium duration-300"
            >
              Publish your theme
            </Link>
          </div>
        </div>
        <div className="relative z-10">
          <Image
            src={"/demo.gif"}
            width={600}
            height={400}
            alt="Demo Gif"
            className="rounded-3xl md:absolute top-0 z-10"
          />
          <div className="rotate-5 bg-ctp-surface0 rounded-3xl w-[600px] h-[400px] hidden md:block" />
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-semibold mb-8">Trending Themes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {trendingThemes.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      </section>
    </main>
  );
}
