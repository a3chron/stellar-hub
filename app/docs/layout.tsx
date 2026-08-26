import type { Metadata } from "next";
import type { ReactNode } from "react";
import DocsNav from "@/components/docs/docs-nav";
import { Toc } from "@/components/docs/toc";

export const metadata: Metadata = {
  title: {
    template: "%s | stellar docs",
    default: "Docs | stellar",
  },
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <DocsNav variant="pills" />
      <div className="flex gap-10">
        <aside className="hidden md:block w-52 shrink-0">
          {/* top-20 clears the 4rem sticky site header with a little air. */}
          <div className="sticky top-20">
            <DocsNav variant="sidebar" />
          </div>
        </aside>
        <article className="min-w-0 flex-1 max-w-3xl pb-32">{children}</article>
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="sticky top-20">
            <Toc />
          </div>
        </aside>
      </div>
    </div>
  );
}
