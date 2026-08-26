import Link from "next/link";
import { DOCS_PAGES, type DocsPageKey } from "./pages";

// NextSteps renders up to two compact link cards at the bottom of a docs
// article - a smaller sibling of the overview page's card grid.
export default function NextSteps({ pages }: { pages: DocsPageKey[] }) {
  const entries = pages
    .map((page) => DOCS_PAGES[page])
    .filter(Boolean)
    .slice(0, 2);

  if (entries.length === 0) {
    // .mdx files aren't typechecked, so a mistyped key would otherwise just
    // render nothing at all.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `NextSteps: no known docs pages in [${pages.join(", ")}] - valid keys are ${Object.keys(DOCS_PAGES).join(", ")}`,
      );
    }
    return null;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4 mt-6">
      {entries.map((entry) => {
        const Icon = entry.icon;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            className="rounded-lg border-2 border-ctp-crust bg-ctp-mantle p-4 flex items-start gap-3 transition hover:ring-2 hover:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-surface0"
          >
            <Icon
              size={20}
              className={`${entry.iconClassName} shrink-0 mt-0.5`}
              aria-hidden="true"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-ctp-text">{entry.title}</span>
              <span className="text-sm text-ctp-subtext0">
                {entry.description}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
