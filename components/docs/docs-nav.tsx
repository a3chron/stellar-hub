"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DOCS_NAV_KEYS, DOCS_PAGES } from "./pages";

interface DocsNavProps {
  variant: "sidebar" | "pills";
}

const VARIANT_CLASSES: Record<
  DocsNavProps["variant"],
  { nav: string; link: string }
> = {
  sidebar: {
    nav: "hidden md:flex flex-col gap-1",
    link: "px-3 py-2 rounded-lg text-sm transition",
  },
  pills: {
    // mb-6 lives here rather than on a wrapper, so it collapses along with
    // the nav at md and doesn't leave a gap above the article.
    nav: "md:hidden flex gap-2 overflow-x-auto pb-2 mb-6",
    link: "px-3 py-2 rounded-lg text-sm whitespace-nowrap transition",
  },
};

export default function DocsNav({ variant }: DocsNavProps) {
  const pathname = usePathname();
  const classes = VARIANT_CLASSES[variant];

  return (
    <nav aria-label="Docs" className={classes.nav}>
      {DOCS_NAV_KEYS.map((key) => {
        const page = DOCS_PAGES[key];
        const current = pathname === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              classes.link,
              current
                ? "bg-ctp-text text-ctp-base font-medium"
                : "text-ctp-subtext0 hover:bg-ctp-surface0 hover:text-ctp-text",
            )}
          >
            {page.title}
          </Link>
        );
      })}
    </nav>
  );
}
