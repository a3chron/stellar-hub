import { desc, eq } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { themes, user } from "@/lib/db/schema";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://stellar.a3chron.dev";

// Sitemaps this size are far outside what a single-server hub like this will
// realistically have themes/authors for; the cap just guarantees the sitemap
// stays well under Google's 50,000-URL-per-file limit and keeps the query
// (and the response) bounded even if usage grows a lot.
const MAX_THEME_ENTRIES = 5000;
const MAX_AUTHOR_ENTRIES = 2000;

// Themes are published continuously by users, so a sitemap baked in at build
// time would never list anything created after the last deploy - defeating
// the point of the ticket. It also has to stay dynamic because `next build`
// runs in CI (.github/workflows/checks.yaml) against dummy env values with no
// real database: a route that queries the DB at build time would fail the
// build there. Forcing this route dynamic means it's rendered fresh per
// request instead, so it never touches the database during `next build`.
export const dynamic = "force-dynamic";

const STATIC_ROUTES = [
  { path: "/", changeFrequency: "daily" as const, priority: 1 },
  { path: "/docs", changeFrequency: "monthly" as const, priority: 0.5 },
  {
    path: "/docs/installing",
    changeFrequency: "monthly" as const,
    priority: 0.5,
  },
  {
    path: "/docs/commands",
    changeFrequency: "monthly" as const,
    priority: 0.5,
  },
  {
    path: "/docs/how-it-works",
    changeFrequency: "monthly" as const,
    priority: 0.5,
  },
  {
    path: "/docs/troubleshooting",
    changeFrequency: "monthly" as const,
    priority: 0.5,
  },
  { path: "/upload", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/login", changeFrequency: "yearly" as const, priority: 0.2 },
  { path: "/legal", changeFrequency: "yearly" as const, priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [themeRows, authorRows] = await Promise.all([
    db
      .select({
        slug: themes.slug,
        screenshotUrl: themes.screenshotUrl,
        updatedAt: themes.updatedAt,
        authorUsername: user.username,
      })
      .from(themes)
      .innerJoin(user, eq(themes.authorId, user.id))
      .orderBy(desc(themes.updatedAt))
      .limit(MAX_THEME_ENTRIES),
    // Only accounts that actually published something. Without the join this
    // lists every registered handle - including accounts that appear nowhere
    // else on the site - which submits empty pages to search engines and
    // publishes the user list.
    db
      .selectDistinct({
        username: user.username,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .innerJoin(themes, eq(themes.authorId, user.id))
      .orderBy(desc(user.updatedAt))
      .limit(MAX_AUTHOR_ENTRIES),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const themeEntries: MetadataRoute.Sitemap = themeRows.map((theme) => ({
    url: `${siteUrl}/${theme.authorUsername}/${theme.slug}`,
    lastModified: theme.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
    images: [theme.screenshotUrl],
  }));

  const authorEntries: MetadataRoute.Sitemap = authorRows.map((author) => ({
    url: `${siteUrl}/${author.username}`,
    lastModified: author.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...themeEntries, ...authorEntries];
}
