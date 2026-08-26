"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function Toc() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [indicator, setIndicator] = useState({ top: 0, height: 0 });
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // Re-collect headings on every route change: this component lives in the
  // persistent docs layout, so switching articles doesn't remount it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname isn't read in the body - it's the intentional re-run trigger
  useEffect(() => {
    linkRefs.current.clear();
    setActiveId(null);
    setIndicator({ top: 0, height: 0 });

    const elements = Array.from(
      document.querySelectorAll("article h2[id], article h3[id]"),
    );

    const items: Heading[] = elements.map((el) => ({
      id: el.id,
      text: el.textContent || "",
      level: el.tagName === "H3" ? 3 : 2,
    }));

    setHeadings(items);

    if (items.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0px 0px -70% 0px" },
    );

    for (const el of elements) {
      observer.observe(el);
    }

    const handleScroll = () => {
      const scrolledToBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (scrolledToBottom) {
        const last = items[items.length - 1];
        if (last) {
          setActiveId(last.id);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  useEffect(() => {
    if (!activeId) {
      return;
    }
    const activeLink = linkRefs.current.get(activeId);
    if (activeLink) {
      setIndicator({
        top: activeLink.offsetTop,
        height: activeLink.offsetHeight,
      });
    }
  }, [activeId]);

  if (headings.length < 2) {
    return null;
  }

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="text-xs uppercase tracking-wide text-ctp-overlay1 mb-3">
        On this page
      </p>
      <div className="relative border-l border-ctp-surface0 flex flex-col">
        <span
          className="absolute -left-px w-0.5 bg-ctp-text rounded-full transition-all duration-300"
          style={{ top: indicator.top, height: indicator.height }}
        />
        {headings.map((heading) => (
          <a
            key={heading.id}
            ref={(el) => {
              if (el) {
                linkRefs.current.set(heading.id, el);
              } else {
                linkRefs.current.delete(heading.id);
              }
            }}
            href={`#${heading.id}`}
            aria-current={activeId === heading.id ? "location" : undefined}
            className={cn(
              "py-1 transition-colors",
              heading.level === 3 ? "pl-7" : "pl-4",
              activeId === heading.id
                ? "text-ctp-text"
                : "text-ctp-subtext0 hover:text-ctp-text",
            )}
          >
            {heading.text}
          </a>
        ))}
      </div>
    </nav>
  );
}

export default Toc;
