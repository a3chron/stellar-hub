"use client";

import {
  AtSign,
  FilePen,
  Palette,
  SquareTerminal,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SettingsNavProps {
  drafts: number;
  themes: number;
  cliLogins: number;
}

// The keys a page can scroll with - anything else (Tab, typing) leaves the
// highlight of a clicked link alone.
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

/**
 * The settings sections as plain anchor links, so /settings#drafts and the
 * browser's own history keep working. From lg up it's a sticky sidebar that
 * highlights the section in view; below that, a row of chips under the
 * header that scrolls sideways.
 */
export default function SettingsNav({
  drafts,
  themes,
  cliLogins,
}: SettingsNavProps) {
  const items = [
    { id: "profile", label: "Profile", icon: UserRound },
    { id: "username", label: "Username", icon: AtSign },
    { id: "drafts", label: "Drafts", icon: FilePen, count: drafts },
    { id: "themes", label: "Themes", icon: Palette, count: themes },
    {
      id: "cli-logins",
      label: "CLI logins",
      icon: SquareTerminal,
      count: cliLogins,
    },
    { id: "danger-zone", label: "Danger zone", icon: TriangleAlert },
  ];
  const active = useActiveSection(items.map((item) => item.id));

  return (
    <nav
      aria-label="Settings sections"
      // Below lg the chips may be wider than a phone: scrolling them sideways
      // is intended, so the row bleeds into the page gutter instead of
      // clipping at it.
      className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:sticky lg:top-24 lg:mx-0 lg:self-start lg:overflow-visible lg:px-0"
    >
      <ul className="flex gap-2 lg:flex-col lg:gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active.id === item.id;
          const danger = item.id === "danger-zone";

          // Below lg a bordered chip; from lg a sidebar row that only shows
          // a border and tint while it's the section in view. Only the
          // sidebar highlights - the chips scroll away with the page, so a
          // highlight there would just look like a selected tab. One branch
          // per state, since two border or background utilities on the same
          // element don't resolve by their order in the class list.
          let tone: string;
          if (danger) {
            tone = isActive
              ? "border-ctp-red/40 text-ctp-red lg:bg-ctp-red/10"
              : "border-ctp-red/40 text-ctp-red hover:bg-ctp-red/10 lg:border-transparent";
          } else if (isActive) {
            tone =
              "border-ctp-surface0 bg-ctp-mantle text-ctp-subtext1 hover:text-ctp-text lg:border-ctp-blue/40 lg:bg-ctp-blue/10 lg:font-medium lg:text-ctp-text";
          } else {
            tone =
              "border-ctp-surface0 bg-ctp-mantle text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text lg:border-transparent lg:bg-transparent";
          }

          return (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                onClick={() => active.select(item.id)}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition lg:rounded-lg lg:py-2",
                  tone,
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0",
                    isActive && !danger && "lg:text-ctp-blue",
                  )}
                />
                <span className="lg:flex-1">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="rounded-full bg-ctp-surface0 px-1.5 text-xs tabular-nums text-ctp-subtext1">
                    {item.count}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Scroll-spy: the section crossing a band just below the sticky header is
 * the current one. Two cases need help:
 *
 * - At the end of the page the last sections can't scroll up into the band,
 *   so once the end of the content is in view, the last section wins.
 * - A clicked link stays highlighted until the user scrolls themselves -
 *   otherwise a section near the end that the click couldn't bring up to
 *   the band would lose the highlight the moment the smooth scroll ends.
 */
function useActiveSection(ids: string[]) {
  const [activeId, setActiveId] = useState(ids[0]);
  const lockedRef = useRef(false);
  const idList = ids.join("\n");

  useEffect(() => {
    const order = idList.split("\n");
    const sections = order
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    const last = sections[sections.length - 1];
    if (!last) {
      return;
    }

    const inBand = new Set<string>();
    let atEnd = false;

    function pick() {
      if (lockedRef.current) {
        return;
      }
      if (atEnd) {
        setActiveId(order[order.length - 1]);
        return;
      }
      const first = order.find((id) => inBand.has(id));
      if (first) {
        setActiveId(first);
      }
    }

    // From just below the header (64px + breathing room) down to 40% of
    // the viewport.
    const bandObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            inBand.add(entry.target.id);
          } else {
            inBand.delete(entry.target.id);
          }
        }
        pick();
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    for (const section of sections) {
      bandObserver.observe(section);
    }

    // The last section's bottom edge coming into view means the content has
    // ended - only the footer is left below.
    const endObserver = new IntersectionObserver(
      ([entry]) => {
        atEnd =
          entry.isIntersecting &&
          entry.intersectionRect.bottom >= entry.boundingClientRect.bottom - 1;
        pick();
      },
      // The section is short, so "fully visible" (1) is when its bottom
      // edge arrives; the lower steps notice it leaving again.
      { threshold: [0, 0.5, 1] },
    );
    endObserver.observe(last);

    // Anything the user does to scroll ends a click's lock.
    function release() {
      if (lockedRef.current) {
        lockedRef.current = false;
        pick();
      }
    }
    function releaseOnKey(event: KeyboardEvent) {
      if (SCROLL_KEYS.has(event.key)) {
        release();
      }
    }
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", releaseOnKey);

    return () => {
      bandObserver.disconnect();
      endObserver.disconnect();
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", releaseOnKey);
    };
  }, [idList]);

  function select(id: string) {
    lockedRef.current = true;
    setActiveId(id);
  }

  return { id: activeId, select };
}
