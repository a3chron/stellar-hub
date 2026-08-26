import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import Callout from "@/components/docs/callout";
import CodeBlock from "@/components/docs/code-block";
import NextSteps from "@/components/docs/next-steps";
import { OSTab, OSTabs } from "@/components/docs/os-tabs";

export function useMDXComponents(): MDXComponents {
  return {
    h1: (props: HTMLAttributes<HTMLHeadingElement>) => (
      <h1 className="text-4xl font-bold mb-6 text-ctp-text" {...props} />
    ),
    h2: (props: HTMLAttributes<HTMLHeadingElement>) => (
      <h2
        className="text-2xl font-semibold mt-10 mb-4 pb-2 border-b border-ctp-surface0 text-ctp-text scroll-mt-24"
        {...props}
      />
    ),
    h3: (props: HTMLAttributes<HTMLHeadingElement>) => (
      <h3
        className="text-xl font-semibold mt-8 mb-3 text-ctp-text scroll-mt-24"
        {...props}
      />
    ),
    p: (props: HTMLAttributes<HTMLParagraphElement>) => (
      <p className="mb-4 leading-relaxed text-ctp-subtext1" {...props} />
    ),
    a: ({
      href,
      children,
      ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <Link
        href={href ?? "#"}
        className="text-ctp-blue underline hover:text-ctp-sky"
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
        {...props}
      >
        {children}
      </Link>
    ),
    ul: (props: HTMLAttributes<HTMLUListElement>) => (
      <ul
        className="list-disc pl-6 mb-4 space-y-1 text-ctp-subtext1"
        {...props}
      />
    ),
    ol: (props: HTMLAttributes<HTMLOListElement>) => (
      <ol
        className="list-decimal pl-6 mb-4 space-y-1 text-ctp-subtext1"
        {...props}
      />
    ),
    li: (props: HTMLAttributes<HTMLLIElement>) => <li {...props} />,
    code: ({ className, ...props }: HTMLAttributes<HTMLElement>) => {
      if (className?.startsWith("language-")) {
        return <code className={className} {...props} />;
      }
      // text-ctp-text, not an accent: Latte's accents don't reach AA
      // contrast on the mantle background (peach was 2.45:1).
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-ctp-mantle border border-ctp-crust text-sm text-ctp-text"
          {...props}
        />
      );
    },
    pre: CodeBlock,
    blockquote: (props: HTMLAttributes<HTMLQuoteElement>) => (
      <blockquote
        className="border-l-4 border-ctp-surface1 pl-4 my-4 text-ctp-subtext0 italic"
        {...props}
      />
    ),
    table: (props: HTMLAttributes<HTMLTableElement>) => (
      <section
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region must be keyboard-focusable (WCAG 2.1.1)
        tabIndex={0}
        aria-label="Table"
        className="overflow-x-auto my-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-surface0"
      >
        <table className="w-full text-sm" {...props} />
      </section>
    ),
    th: (props: HTMLAttributes<HTMLTableCellElement>) => (
      <th
        className="text-left p-2 bg-ctp-mantle border-b-2 border-ctp-crust font-semibold"
        {...props}
      />
    ),
    td: (props: HTMLAttributes<HTMLTableCellElement>) => (
      <td
        className="p-2 border-b border-ctp-crust text-ctp-subtext1"
        {...props}
      />
    ),
    hr: (props: HTMLAttributes<HTMLHRElement>) => (
      <hr className="my-8 border-ctp-surface0" {...props} />
    ),
    Callout,
    NextSteps,
    OSTabs,
    OSTab,
  };
}
