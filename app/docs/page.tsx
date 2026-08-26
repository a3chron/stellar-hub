import type { Metadata } from "next";
import Link from "next/link";
import { DOCS_CARD_KEYS, DOCS_PAGES } from "@/components/docs/pages";

// Spelled out rather than relying on the layout's title template: Next does
// not apply a template to a page in the same segment as the layout that
// declares it, so this would otherwise render as a bare "Overview".
export const metadata: Metadata = { title: "Overview | stellar docs" };

const CARDS = DOCS_CARD_KEYS.map((key) => DOCS_PAGES[key]);

export default function DocsPage() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-2">Documentation</h1>
      <p className="text-ctp-subtext0">
        Everything you need to install, configure and troubleshoot stellar.
      </p>

      <div className="grid sm:grid-cols-2 gap-6 mt-8">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border-2 border-ctp-crust bg-ctp-mantle p-6 flex flex-col gap-3 transition hover:ring-2 hover:ring-ctp-surface0 ring-offset-4 ring-offset-ctp-base"
          >
            <card.icon size={28} className={card.iconClassName} />
            <span className="text-lg font-semibold">{card.title}</span>
            <span className="text-sm text-ctp-subtext0">
              {card.description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
