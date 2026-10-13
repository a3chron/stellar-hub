import Link from "next/link";

export default function DraftNotFound() {
  return (
    <main className="bg-ctp-base">
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-ctp-text mb-4">
            This draft doesn't exist (anymore)
          </h1>
          <p className="text-ctp-subtext0 leading-relaxed mb-8">
            It may have been published or deleted, or it expired after 7 days
            without changes. Drafts are only visible to the account that created
            them - check that you're signed in as the right one.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/upload"
              className="px-6 py-2 bg-ctp-text hover:bg-ctp-subtext1 border-2 border-ctp-subtext0 text-ctp-base rounded-lg font-semibold transition"
            >
              Start a new theme
            </Link>
            <Link
              href="/settings#drafts"
              className="px-6 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-lg border-2 border-ctp-surface1 transition"
            >
              Your drafts
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
