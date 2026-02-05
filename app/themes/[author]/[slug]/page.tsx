import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";

interface PageProps {
  params: {
    author: string;
    slug: string;
  };
}

export default async function ThemePage({ params }: PageProps) {
  const theme = await db.query.themes.findFirst({
    where: and(eq(themes.slug, params.slug)),
    with: {
      author: true,
      versions: {
        orderBy: (versions, { desc }) => [desc(versions.createdAt)],
      },
      colorScheme: true,
      group: true,
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
          className="rounded-lg shadow-lg mb-8"
        />

        <div className="bg-gray-100 rounded p-4 mb-8">
          <code className="text-sm">
            stellar apply {theme.author.name}/{theme.slug}
          </code>
        </div>

        {theme.description && (
          <p className="text-lg mb-8">{theme.description}</p>
        )}

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Versions</h2>
          {theme.versions.map((version) => (
            <div
              key={version.id}
              className="border-l-4 border-blue-500 pl-4 mb-4"
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
              {latestVersion.dependencies.map((dep, i) => (
                <li key={i}>{dep.name}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
