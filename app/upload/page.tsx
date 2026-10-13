import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import ThemeWizard from "@/components/wizard/theme-wizard";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export default async function UploadPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login?callbackUrl=/upload");
  }

  // Fetch color schemes for the select dropdown
  const colorSchemes = await db.query.colorSchemes.findMany({
    orderBy: (colorSchemes, { asc }) => [asc(colorSchemes.name)],
  });

  // Always set in the database; better-auth only types it as optional.
  const author =
    session.user.username ??
    (
      await db.query.user.findFirst({
        where: eq(user.id, session.user.id),
        columns: { username: true },
      })
    )?.username ??
    "";

  return (
    <main className="bg-ctp-base">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-ctp-text mb-2">
            Publish Theme
          </h1>
          <p className="mb-8 text-ctp-subtext0">
            Share your Starship theme with the community. Prefer the terminal?{" "}
            <Link
              href="/docs/publishing"
              className="text-ctp-lavender underline underline-offset-2"
            >
              stellar publish
            </Link>{" "}
            does it too.
          </p>
          <ThemeWizard
            author={author}
            colorSchemes={colorSchemes}
            initialDraft={null}
          />
        </div>
      </div>
    </main>
  );
}

export const metadata = {
  // The root layout's title.template appends " - Stellar" automatically.
  title: "Upload Theme",
  description: "Share your Starship theme with the community",
};
