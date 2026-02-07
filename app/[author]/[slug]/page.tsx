import { and, eq } from "drizzle-orm";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import ApplyCommand from "./apply-command";

interface PageProps {
  params: Promise<{
    author: string;
    slug: string;
  }>;
}

export default async function ThemePage({ params }: PageProps) {
  const { author: authorName, slug: themeSlug } = await params;

  // First find the author by name
  const author = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.name, authorName),
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

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">{theme.name}</h1>
        <p className="text-gray-600 mb-8">
          by {theme.author.name} • {theme.downloads} downloads
        </p>

        <Image
          src={theme.screenshotUrl}
          alt={theme.name}
          width={1200}
          height={800}
          className="rounded-lg shadow-lg border-2 border-ctp-crust mb-8"
        />

        <ApplyCommand author={author.name} theme={theme.slug} />

        {theme.description && (
          <p className="text-lg mb-8">{theme.description}</p>
        )}

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Versions</h2>
          {theme.versions.map((version) => (
            <div
              key={version.id}
              className="border-l-4 border-ctp-text pl-4 mb-4"
            >
              <h3 className="font-semibold">{version.version}</h3>
              {version.versionNotes && (
                <p className="text-gray-600">{version.versionNotes}</p>
              )}
            </div>
          ))}
        </section>

        {latestVersion.dependencies && (
          <section>
            <h2 className="text-2xl font-semibold mb-4">Dependencies</h2>
            <ul className="list-disc list-inside">
              {latestVersion.dependencies.map((dep) => (
                <li key={dep.name}>{dep.name}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
