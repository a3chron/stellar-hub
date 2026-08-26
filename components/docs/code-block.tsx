import type { ReactElement } from "react";
import { isValidElement } from "react";
import { bundledLanguages, codeToHtml } from "shiki";
import CopyButton from "./copy-button";

interface CodeElementProps {
  className?: string;
  children?: string;
}

export default async function CodeBlock(
  props: React.HTMLAttributes<HTMLPreElement>,
) {
  const child = props.children;

  let codeElement: ReactElement<CodeElementProps> | null = null;
  if (isValidElement(child)) {
    codeElement = child as ReactElement<CodeElementProps>;
  }

  if (!codeElement || typeof codeElement.props.children !== "string") {
    return (
      <pre className="my-6 rounded-lg border-2 border-ctp-crust bg-ctp-mantle overflow-x-auto p-4 text-sm text-ctp-text">
        {child}
      </pre>
    );
  }

  const className = codeElement.props.className ?? "";
  const langMatch = className.match(/language-([\w+#-]+)/);
  const requestedLang = langMatch ? langMatch[1] : "text";
  // codeToHtml throws on unregistered languages, which would take down the
  // whole docs page over a typo'd fence - fall back to plain text instead.
  const lang = requestedLang in bundledLanguages ? requestedLang : "text";
  const code = codeElement.props.children.trimEnd();

  let html: string;
  try {
    html = await codeToHtml(code, {
      lang,
      themes: { light: "catppuccin-latte", dark: "catppuccin-mocha" },
      defaultColor: false,
      transformers: [
        {
          // Shiki makes its own <pre> focusable. The scrollable region is the
          // <section> below, so the inner one is a second, dead tab stop on
          // every code block.
          pre(node) {
            delete node.properties.tabindex;
          },
        },
      ],
    });
  } catch {
    return (
      <pre className="my-6 rounded-lg border-2 border-ctp-crust bg-ctp-mantle overflow-x-auto p-4 text-sm text-ctp-text">
        {code}
      </pre>
    );
  }

  return (
    <div className="group relative my-6 rounded-lg border-2 border-ctp-crust bg-ctp-mantle overflow-hidden">
      <CopyButton text={code} className="absolute top-2 right-2 z-10" />
      {/* pr-14 keeps the last characters of long lines clear of the
          overlaid copy button; tabIndex makes the region keyboard-scrollable. */}
      <section
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region must be keyboard-focusable (WCAG 2.1.1)
        tabIndex={0}
        aria-label="Code"
        className="overflow-x-auto p-4 pr-14 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-surface0 ring-inset"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki-generated HTML
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
