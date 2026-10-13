import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ThemeWizard from "@/components/wizard/theme-wizard";
import VersionWizard from "@/components/wizard/version-wizard";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { findLiveDraft, purgeExpiredDrafts, serializeOne } from "@/lib/drafts";

export const metadata: Metadata = {
  title: "Finish Draft",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ code: string }> };

/**
 * A draft in the upload wizard - the link `stellar publish` prints, and where
 * /upload moves to once its first step is saved. Only the draft's owner can
 * open it; for anyone else it doesn't exist.
 */
export default async function DraftPage({ params }: PageProps) {
  const { code } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/upload/${code}`)}`);
  }

  await purgeExpiredDrafts(session.user.id);
  const row = await findLiveDraft(session.user.id, code);
  if (!row) {
    notFound();
  }

  const draft = await serializeOne(row, { includeConfig: true });

  const owner = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: { username: true },
  });
  const author = owner?.username ?? "";

  if (draft.kind === "version") {
    return (
      <main className="bg-ctp-base">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold text-ctp-text mb-2">
              New Version
            </h1>
            <p className="mb-8 text-ctp-subtext0">
              Of{" "}
              <span className="text-ctp-text">
                {draft.theme?.name ?? "your theme"}
              </span>{" "}
              <span className="font-mono text-sm">
                ({author}/{draft.theme?.slug})
              </span>
            </p>
            <VersionWizard author={author} initialDraft={draft} />
          </div>
        </div>
      </main>
    );
  }

  const colorSchemes = await db.query.colorSchemes.findMany({
    orderBy: (colorSchemes, { asc }) => [asc(colorSchemes.name)],
  });

  return (
    <main className="bg-ctp-base">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-ctp-text mb-2">
            Publish Theme
          </h1>
          <p className="mb-8 text-ctp-subtext0">
            Share your Starship theme with the community
          </p>
          <ThemeWizard
            author={author}
            colorSchemes={colorSchemes}
            initialDraft={draft}
          />
        </div>
      </div>
    </main>
  );
}
