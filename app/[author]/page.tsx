import { GithubIcon, GlobeIcon, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ThemeCard from "@/components/theme-card";
import { db } from "@/lib/db";

interface PageProps {
  params: Promise<{
    author: string;
  }>;
}

export default async function AuthorPage({ params }: PageProps) {
  const { author: authorName } = await params;

  // Find author by name
  const author = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.name, authorName),
    with: {
      themes: {
        with: {
          colorScheme: true,
          versions: {
            orderBy: (versions, { desc }) => [desc(versions.createdAt)],
            limit: 1,
          },
        },
        orderBy: (themes, { desc }) => [desc(themes.downloads)],
      },
    },
  });

  if (!author) {
    return notFound();
  }

  const totalDownloads = author.themes.reduce(
    (sum, theme) => sum + theme.downloads,
    0,
  );

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Author Profile Header */}
        <div className="flex items-start gap-8 mb-12">
          {/* Profile Image */}
          <div className="shrink-0">
            {author.image ? (
              <Image
                src={author.image}
                alt={author.name}
                width={120}
                height={120}
                className="rounded-full border-2 border-ctp-crust"
              />
            ) : (
              <div className="w-[120px] h-[120px] rounded-full border-2 border-ctp-crust bg-ctp-mantle flex items-center justify-center">
                <User className="w-12 h-12 text-ctp-subtext0" />
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex items-center gap-8">
              <h1 className="text-4xl font-bold mb-2">{author.name}</h1>
              <div className="flex gap-4">
                {author.socialLinks?.github && (
                  <Link
                    href={`https://github.com/${author.socialLinks.github}`}
                    className="bg-ctp-crust rounded-full p-2 ring-2 ring-ctp-surface0 hover:ring-offset-2 ring-offset-ctp-base duration-300"
                  >
                    <GithubIcon size={16} />
                  </Link>
                )}
                {author.socialLinks?.website && (
                  <Link
                    href={author.socialLinks.website}
                    className="bg-ctp-crust rounded-full p-2 ring-2 ring-ctp-surface0 hover:ring-offset-2 ring-offset-ctp-base duration-300"
                  >
                    <GlobeIcon size={16} />
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 text-ctp-subtext0">
              <div>
                <span className="font-semibold text-ctp-subtext1">
                  {author.themes.length}
                </span>{" "}
                {author.themes.length === 1 ? "theme" : "themes"}
              </div>
              <div>
                <span className="font-semibold text-ctp-subtext1">
                  {totalDownloads.toLocaleString()}
                </span>{" "}
                total downloads
              </div>
              <div className="text-sm">
                Joined{" "}
                {new Date(author.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>

            {author.bio && (
              <p className="text-lg my-4 text-ctp-subtext1">{author.bio}</p>
            )}
          </div>
        </div>

        {/* Themes Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">
            Themes by {author.name}
          </h2>

          {author.themes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-ctp-subtext1">
                {author.name} hasn't published any themes yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {author.themes.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={{
                    slug: theme.slug,
                    name: theme.name,
                    screenshotUrl: theme.screenshotUrl,
                    downloads: theme.downloads,
                    author: {
                      name: author.name,
                    },
                    colorScheme: theme.colorScheme || null,
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
  const { author: authorName } = await params;

  const author = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.name, authorName),
  });

  if (!author) {
    return {
      title: "Author Not Found",
    };
  }

  return {
    title: `${author.name} - Stellar`,
    description: author.bio || `Starship themes by ${author.name}`,
    openGraph: {
      title: `${author.name} - Stellar`,
      description: author.bio || `Starship themes by ${author.name}`,
      images: author.image ? [author.image] : [],
    },
  };
}
