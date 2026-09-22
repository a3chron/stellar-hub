import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "@/components/markdown";
import ThemeCard from "@/components/theme-card";
import { ThemeVersionsSection } from "@/components/theme-versions-section";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { hasCustomSections } from "@/lib/toml-custom-detect";
import { usernameEquals } from "@/lib/username";
import { formatDownloads } from "@/lib/utils";
import ApplyCommand from "./apply-command";
import { ThemeScreenshot } from "./theme-screenshot";

interface PageProps {
  params: Promise<{
    author: string;
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { author: authorName, slug: themeSlug } = await params;

  const author = await db.query.user.findFirst({
    where: (user) => usernameEquals(user.username, authorName),
  });

  if (!author) {
    // The root layout's title.template appends " - Stellar" automatically.
    return {
      title: "Theme Not Found",
    };
  }

  const theme = await db.query.themes.findFirst({
    where: and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)),
  });

  if (!theme) {
    return {
      title: "Theme Not Found",
    };
  }

  const description =
    theme.description || `${theme.name} - A Starship theme by ${author.name}`;

  return {
    // The root layout's title.template appends " - Stellar" automatically.
    title: `${theme.name} by ${author.name}`,
    description,
    openGraph: {
      title: `${theme.name} - Stellar`,
      description,
      images: [theme.screenshotUrl],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${theme.name} - Stellar`,
      description,
      images: [theme.screenshotUrl],
    },
  };
}

export default async function ThemePage({ params }: PageProps) {
  const { author: authorName, slug: themeSlug } = await params;

  // First find the author by name
  const author = await db.query.user.findFirst({
    where: (user) => usernameEquals(user.username, authorName),
  });

  if (!author) {
    return notFound();
  }

  // Then find the theme
  const theme = await db.query.themes.findFirst({
    where: and(eq(themes.authorId, author.id), eq(themes.slug, themeSlug)),
    with: {
      author: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
          bio: true,
        },
      },
      versions: {
        orderBy: (versions, { desc }) => [desc(versions.createdAt)],
      },
      colorScheme: true,
    },
  });

  if (!theme) return notFound();

  const latestVersion = theme.versions[0];

  // Fetch related themes in the same group (if group exists)
  const relatedThemes = theme.group
    ? await db.query.themes.findMany({
        where: and(
          eq(themes.authorId, author.id),
          eq(themes.group, theme.group),
          // Exclude the current theme
          eq(themes.slug, themeSlug) ? undefined : eq(themes.slug, themeSlug),
        ),
        with: {
          author: {
            columns: {
              name: true,
              username: true,
            },
          },
          colorScheme: true,
        },
      })
    : [];

  // Filter out the current theme from related themes
  const filteredRelatedThemes = relatedThemes.filter(
    (t) => t.slug !== themeSlug,
  );

  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://stellar.a3chron.dev";
  const themeUrl = `${siteUrl}/${author.username}/${theme.slug}`;

  // SoftwareApplication rather than CreativeWork: a Starship theme is a
  // versioned, downloadable config the CLI installs and applies (it has a
  // softwareVersion, an operatingSystem, dependencies), which SoftwareApplication
  // models directly - the same way theme/plugin marketplaces (WordPress
  // themes, browser extensions) mark themselves up for search.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: theme.name,
    description:
      theme.description || `${theme.name} - A Starship theme by ${author.name}`,
    image: theme.screenshotUrl,
    url: themeUrl,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Cross-platform",
    softwareVersion: latestVersion?.version,
    author: {
      "@type": "Person",
      name: author.name,
      url: `${siteUrl}/${author.username}`,
    },
    ...(theme.downloads > 0 && {
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/DownloadAction",
        userInteractionCount: theme.downloads,
      },
    }),
  };

  return (
    <main className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, values are server-controlled DB fields, not user-supplied HTML
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">{theme.name}</h1>
        <p className="text-ctp-subtext0 mb-8">
          by{" "}
          <Link className="text-ctp-text" href={`/${theme.author.username}`}>
            {theme.author.name}
          </Link>{" "}
          •{" "}
          <span title={`${theme.downloads.toLocaleString("en-US")} downloads`}>
            {formatDownloads(theme.downloads)}
          </span>
        </p>

        <ThemeScreenshot src={theme.screenshotUrl} alt={theme.name} />

        <ApplyCommand author={author.username} theme={theme.slug} />

        {theme.description && (
          <div className="mb-8 text-ctp-subtext1">
            <Markdown>{theme.description}</Markdown>
          </div>
        )}

        {latestVersion.dependencies && (
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Dependencies</h2>
            <ul className="list-disc list-inside">
              {latestVersion.dependencies.map((dep) => (
                <li key={dep}>{dep}</li>
              ))}
            </ul>
          </section>
        )}

        <ThemeVersionsSection
          author={author.username}
          slug={themeSlug}
          versions={theme.versions}
          // Computed here rather than in the client component: it is a full
          // TOML parse per version, and doing it during render would both
          // repeat on every re-render and ship the parser to the browser.
          hasCustomByVersion={Object.fromEntries(
            theme.versions.map((v) => [
              v.version,
              hasCustomSections(v.configContent),
            ]),
          )}
        />

        {/* Related Themes Section */}
        {filteredRelatedThemes.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">
              Other themes in this group
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredRelatedThemes.map((relatedTheme) => (
                <ThemeCard key={relatedTheme.id} theme={relatedTheme} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
