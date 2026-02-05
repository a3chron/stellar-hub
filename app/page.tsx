import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import ThemeCard from "@/components/theme-card";

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
      <section className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4">Stellar</h1>
        <p className="text-xl text-gray-600">
          Beautiful Starship themes, one command away
        </p>
      </section>

      <section>
        <h2 className="text-3xl font-semibold mb-8">Trending Themes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trendingThemes.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      </section>
    </main>
  );
}
