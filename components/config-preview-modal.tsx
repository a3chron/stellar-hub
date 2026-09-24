"use client";

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findCustomSections } from "@/lib/toml-custom-sections";
import { cn } from "@/lib/utils";
import type { TomlLineTokens } from "./toml/highlighter";
import { TomlLineContent } from "./toml/toml-line";
import { useTomlTokens } from "./toml/use-toml-tokens";

interface ConfigPreviewData {
  version: string;
  configContent: string;
  hasCustomCommands: boolean;
  versionNotes: string | null;
  dependencies: string[] | null;
  minStarshipVersion: string | null;
  createdAt: string;
}

interface ConfigPreviewModalProps {
  author: string;
  slug: string;
  version: string;
  isOpen: boolean;
  onClose: () => void;
}

// Renders a config's lines, wrapping every `[custom.*]` section (header
// through its last body line) in a highlighted block so a stellar review
// link can draw the eye straight to the parts that run shell commands. Runs
// entirely off line indices - it never touches the underlying string, so the
// text stays exactly as fetched (the copy button still copies the original).
function HighlightedConfig({
  configContent,
  sections,
  activeSectionIndex,
  sectionRefs,
  tokens,
}: {
  configContent: string;
  sections: ReturnType<typeof findCustomSections>;
  activeSectionIndex: number;
  sectionRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  // `null` while the highlighter is still loading (or failed) - lines fall
  // back to plain text in that case, same as everywhere else that consumes
  // useTomlTokens.
  tokens: TomlLineTokens[] | null;
}) {
  const lines = configContent.split("\n");
  // Every line div gets min-h-lh: a blank line renders no tokens, and an
  // empty block has no height, which collapsed the blank lines between
  // modules. (It only worked before for CRLF configs, where a "blank" line
  // still held an invisible \r.)
  const nodes: React.ReactNode[] = [];

  let lineIndex = 0;
  let sectionIndex = 0;

  while (lineIndex < lines.length) {
    const section = sections[sectionIndex];

    if (section && lineIndex === section.startLine) {
      const isActive = sectionIndex === activeSectionIndex;
      const sectionLines = lines.slice(section.startLine, section.endLine);
      const capturedIndex = sectionIndex;

      nodes.push(
        <div
          key={`section-${section.startLine}`}
          ref={(el) => {
            sectionRefs.current[capturedIndex] = el;
          }}
          data-section-index={capturedIndex}
          className={cn(
            "whitespace-pre -ml-2 border-l-4 pl-1.5 transition-colors",
            isActive
              ? "border-ctp-peach bg-ctp-peach/20"
              : "border-ctp-peach/50 bg-ctp-peach/10",
          )}
        >
          {sectionLines.map((text, offset) => {
            const absoluteLine = section.startLine + offset;
            return (
              <div key={`${section.startLine}-${offset}`} className="min-h-lh">
                <TomlLineContent text={text} tokens={tokens?.[absoluteLine]} />
              </div>
            );
          })}
        </div>,
      );

      lineIndex = section.endLine;
      sectionIndex += 1;
      continue;
    }

    nodes.push(
      <div className="whitespace-pre min-h-lh" key={`line-${lineIndex}`}>
        <TomlLineContent text={lines[lineIndex]} tokens={tokens?.[lineIndex]} />
      </div>,
    );
    lineIndex += 1;
  }

  // The wrapper - not the individual sections - is what gets sized to the
  // content. A block element inside a horizontally scrolling <pre> is sized by
  // its container, so without this the highlights would stop at the visible
  // right edge and leave the rest of a long command unhighlighted once
  // scrolled. Sizing each section to its own widest line instead would fix
  // that but leave every highlight ending at a different place; sizing the
  // wrapper once makes them all run to the same full width.
  return <div className="shiki w-max min-w-full">{nodes}</div>;
}

// When a single modal instance is reused to view different versions (e.g.
// deep-linking between them), render it with `key={version}` at the call
// site. That forces React to remount - rather than patch - the component on
// a version switch, so fetched data and stepper state reset for free instead
// of needing manual effects to invalidate them.
// How close to either end of the scroll range still counts as "at" it.
const SCROLL_EDGE_TOLERANCE = 4;

/**
 * Which of the visible custom sections the counter should report.
 *
 * Normally the one nearest the middle of the viewport - that is where
 * scrollToSection puts its target. But a section near the start or end of the
 * config cannot be centred: the scroll clamps, it stays near the edge, and a
 * short neighbour a couple of lines away ends up closer to the middle. The
 * counter then read "2 / N" while the view sat on the first section. At
 * either end of the scroll range the edge section is the answer instead.
 */
function pickActiveSection(
  container: HTMLElement,
  visible: Set<number>,
  sections: (HTMLElement | null)[],
): number {
  if (visible.size === 0) return -1;

  const indices = [...visible].sort((a, b) => a - b);
  if (container.scrollTop <= SCROLL_EDGE_TOLERANCE) {
    return indices[0];
  }
  const maxScroll = container.scrollHeight - container.clientHeight;
  if (container.scrollTop >= maxScroll - SCROLL_EDGE_TOLERANCE) {
    return indices[indices.length - 1];
  }

  const viewportMiddle =
    container.getBoundingClientRect().top + container.clientHeight / 2;
  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const index of indices) {
    const el = sections[index];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const distance = Math.abs(rect.top + rect.height / 2 - viewportMiddle);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  }
  return nearest;
}

export function ConfigPreviewModal({
  author,
  slug,
  version,
  isOpen,
  onClose,
}: ConfigPreviewModalProps) {
  const [data, setData] = useState<ConfigPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Set while an arrow-click or the initial deep-link jump is smooth-scrolling
  // the container, and cleared once that scroll settles. The IntersectionObserver
  // scroll-spy checks this and ignores intersection changes while it's set, so a
  // programmatic scroll from section 2 to section 4 doesn't get its counter
  // clobbered by the observer briefly reporting section 3 mid-flight.
  const isProgrammaticScrollRef = useRef(false);
  const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Sections currently intersecting the observer's (top-biased) viewport.
  const visibleSectionsRef = useRef<Set<number>>(new Set());
  // Guards the one-time "jump to the first custom section" effect so it only
  // fires once per modal instance (the component remounts per version via
  // `key={version}`, so this resets naturally on a version change).
  const hasScrolledToFirstSectionRef = useRef(false);
  // The section we last jumped to, until the user scrolls by hand. While set,
  // the counter stays on it and layout changes (a web font swapping in,
  // highlighting) re-centre it instead of letting a neighbour drift into the
  // middle and take over the counter.
  const anchorSectionRef = useRef<number | null>(null);

  // Tracks that a fetch was attempted for this modal instance. A plain
  // `!loading` guard is not enough: the catch clears `loading`, which is in the
  // dependency list, so any 404 or offline error re-triggered the effect and
  // hammered the endpoint in a spinner/error flicker loop. The parent remounts
  // this component per version (`key={openVersion}`), so the ref resets
  // naturally when a different version is opened.
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!isOpen || hasFetched.current) {
      return;
    }
    hasFetched.current = true;
    setLoading(true);
    setError(null);

    fetch(`/api/${author}/${slug}/${version}?preview=true`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch config");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isOpen, author, slug, version]);

  const customSections = useMemo(
    () => (data ? findCustomSections(data.configContent) : []),
    [data],
  );
  const tokens = useTomlTokens(data?.configContent ?? "");

  // Rebuilds the visible-section set from geometry.
  //
  // The observer callback ignores everything that fires during a programmatic
  // scroll, and those entries are gone for good - IntersectionObserver reports
  // *changes*, so once the scroll settles nothing fires again and the set stays
  // stale forever. Without this, stepping 0 -> 1 and then scrolling by hand to
  // 2 leaves the set as {0, 2}: section 1 is centred on screen but is not even
  // a candidate, and the counter reads "3 / 3" while the user looks at the
  // second command.
  const recomputeVisibleSections = useCallback((preserveActive = false) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    visibleSectionsRef.current.clear();

    sectionRefs.current.forEach((el, index) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const isVisible =
        rect.bottom > containerRect.top && rect.top < containerRect.bottom;
      if (isVisible) {
        visibleSectionsRef.current.add(index);
      }
    });

    // After a programmatic scroll the active section is already known - it is
    // the one we just scrolled to. Re-deciding here would override it, and for
    // a section taller than the viewport it reliably picks the *previous* one
    // (the target cannot be centred, so its midpoint sits far below the
    // middle while its predecessor's bottom edge still clips the top). That
    // snapped the counter backwards and then deadlocked the stepper: clicking
    // "next" again recomputed the same scroll offset, so nothing moved, no
    // scrollend fired, and the timeout put it back. Same effect at the bottom
    // clamp, and on the deep-link jump when the first section is already at
    // the top - the modal would open reading "2 / N".
    if (
      preserveActive ||
      anchorSectionRef.current !== null ||
      visibleSectionsRef.current.size === 0
    ) {
      return;
    }

    const picked = pickActiveSection(
      container,
      visibleSectionsRef.current,
      sectionRefs.current,
    );
    if (picked !== -1) {
      setActiveSectionIndex(picked);
    }
  }, []);

  const scrollToSection = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = scrollContainerRef.current;
      const target = sectionRefs.current[index];
      if (!container || !target) return;

      anchorSectionRef.current = index;
      isProgrammaticScrollRef.current = true;
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
      }
      // Safety net: `scrollend` isn't supported everywhere (older Safari) and
      // won't fire at all if the computed offset matches the current scroll
      // position (nothing actually scrolls). Without this, the programmatic
      // flag could stay stuck forever and permanently freeze the scroll-spy.
      scrollEndTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        scrollEndTimeoutRef.current = null;
        // Only ever armed by scrollToSection, so this is always programmatic.
        recomputeVisibleSections(true);
      }, 700);

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const relativeTop =
        targetRect.top - containerRect.top + container.scrollTop;

      // Centre the section so there is context visible above and below it. A
      // section taller than the viewport cannot be centred - aligning its top
      // just inside the edge is the useful thing there, since scrolling past its
      // beginning is exactly what we are trying to avoid.
      const spare = container.clientHeight - targetRect.height;
      const offset = spare > 48 ? relativeTop - spare / 2 : relativeTop - 16;

      container.scrollTo({ top: Math.max(offset, 0), behavior });
    },
    [recomputeVisibleSections],
  );

  const stepSection = useCallback(
    (direction: 1 | -1) => {
      const next = activeSectionIndex + direction;
      if (next < 0 || next >= customSections.length) return;

      setActiveSectionIndex(next);
      // Deferred to the next frame so the newly-active section has re-rendered
      // with its "active" styling before we measure it. Kept outside the state
      // updater: updaters must be pure, and React 19 StrictMode double-invokes
      // them in development.
      requestAnimationFrame(() => scrollToSection(next));
    },
    [activeSectionIndex, customSections.length, scrollToSection],
  );

  // Clears the "programmatic scroll in progress" flag once the browser
  // reports the smooth-scroll actually settled, rather than relying solely
  // on the fixed timeout in `scrollToSection`. `scrollend` fires on the
  // element that was scrolled, so it's attached directly to the scroll
  // container (it doesn't bubble to the document the way `scroll` events on
  // window do).
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScrollEnd = () => {
      // Read before clearing: this listener fires for user scrolls as well,
      // and only a programmatic one should keep its active section pinned.
      const wasProgrammatic = isProgrammaticScrollRef.current;
      isProgrammaticScrollRef.current = false;
      recomputeVisibleSections(wasProgrammatic);
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = null;
      }
    };

    container.addEventListener("scrollend", handleScrollEnd);
    return () => {
      container.removeEventListener("scrollend", handleScrollEnd);
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = null;
      }
    };
  }, [recomputeVisibleSections]);

  // Problem 1: on arrival via the deep link, jump the container to the first
  // custom section once the config has actually rendered (refs need to
  // exist), instead of leaving the view at the top while the counter reads
  // "1 / N". Keyed on `data`/`customSections`, not `isOpen`, and guarded so
  // it only runs once per modal instance.
  useEffect(() => {
    if (
      !data ||
      customSections.length === 0 ||
      hasScrolledToFirstSectionRef.current
    ) {
      return;
    }
    hasScrolledToFirstSectionRef.current = true;
    // Measure after web fonts have loaded: before that the fallback font's
    // line height puts every line elsewhere, and the jump lands a section off.
    document.fonts.ready.then(() => scrollToSection(0));
  }, [data, customSections, scrollToSection]);

  // Releases the anchor as soon as the user scrolls themselves - from then on
  // the counter follows what they are looking at.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const release = () => {
      anchorSectionRef.current = null;
    };
    const releaseOnScrollKey = (event: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      ) {
        release();
      }
    };

    // mousedown covers dragging the scrollbar.
    container.addEventListener("wheel", release, { passive: true });
    container.addEventListener("touchstart", release, { passive: true });
    container.addEventListener("mousedown", release);
    document.addEventListener("keydown", releaseOnScrollKey);
    return () => {
      container.removeEventListener("wheel", release);
      container.removeEventListener("touchstart", release);
      container.removeEventListener("mousedown", release);
      document.removeEventListener("keydown", releaseOnScrollKey);
    };
  }, []);

  // Keeps the anchored section centred when the content changes size after
  // the jump (font swap, token colours arriving, images above loading).
  useEffect(() => {
    // The wrapper around the config lines (the sections' shared parent), not
    // the scroll container's first child - that is the loading/error slot.
    if (!data || customSections.length === 0) return;
    const content = sectionRefs.current[0]?.parentElement;
    if (!content) return;

    const observer = new ResizeObserver(() => {
      if (anchorSectionRef.current !== null) {
        scrollToSection(anchorSectionRef.current, "auto");
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [data, customSections, scrollToSection]);

  // Problem 3: scroll-spy. As the user manually scrolls the container,
  // update `activeSectionIndex` to whichever custom section is currently
  // nearest the top of the viewport, using IntersectionObserver (cheaper and
  // less jittery than computing positions on every scroll event).
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || customSections.length === 0) return;

    visibleSectionsRef.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        // Ignore intersection changes caused by our own smooth-scroll (arrow
        // click or the initial deep-link jump) so the counter doesn't
        // flicker through sections it's merely passing over mid-flight.
        if (isProgrammaticScrollRef.current) return;

        for (const entry of entries) {
          const indexAttr = entry.target.getAttribute("data-section-index");
          if (indexAttr === null) continue;
          const index = Number(indexAttr);
          if (entry.isIntersecting) {
            visibleSectionsRef.current.add(index);
          } else {
            visibleSectionsRef.current.delete(index);
          }
        }

        // Several sections can be visible at once. Pick the one nearest the
        // middle of the viewport, which is both what "the section you are
        // looking at" means while scrolling and where scrollToSection puts its
        // target - a top-biased rule would report the *previous* section right
        // after a centred jump and snap the counter backwards.
        //
        // Not while anchored: then the visible set is kept current, but the
        // counter stays on the section the user was sent to.
        if (anchorSectionRef.current !== null) return;
        const picked = pickActiveSection(
          container,
          visibleSectionsRef.current,
          sectionRefs.current,
        );
        if (picked !== -1) {
          setActiveSectionIndex(picked);
        }
      },
      {
        root: container,
        // Full viewport: the nearest-to-middle rule above does the selecting,
        // so cropping the observed area would only hide candidates from it.
        rootMargin: "0px",
        threshold: 0,
      },
    );

    for (const el of sectionRefs.current) {
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [customSections]);

  const handleCopy = useCallback(() => {
    if (data?.configContent) {
      navigator.clipboard.writeText(data.configContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [data]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (customSections.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "j") {
        e.preventDefault();
        stepSection(1);
      } else if (
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft" ||
        e.key === "k"
      ) {
        e.preventDefault();
        stepSection(-1);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, customSections.length, stepSection]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ctp-crust/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface0">
          <h2 className="text-xl font-semibold">Config Preview - v{version}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ctp-subtext0 hover:text-ctp-text transition-colors p-1"
            aria-label="Close"
          >
            <XIcon size={24} />
          </button>
        </div>

        {/* Review stepper. Deliberately part of the modal chrome rather than
            the scrolling config: it is always visible without a sticky element
            overlapping the first lines of the file, and the scroll container's
            top edge stays clean. */}
        {data && customSections.length > 0 && (
          <div className="border-b border-ctp-surface0 px-6 py-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ctp-peach/30 bg-ctp-peach/5 px-4 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-live="polite"
                  className="whitespace-nowrap text-sm font-medium text-ctp-peach"
                >
                  Reviewing custom command {activeSectionIndex + 1} /{" "}
                  {customSections.length}
                </span>
                <code className="truncate rounded bg-ctp-surface0 px-1.5 py-0.5 text-xs text-ctp-subtext1">
                  {customSections[activeSectionIndex].name}
                </code>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepSection(-1)}
                  disabled={activeSectionIndex === 0}
                  aria-label="Previous custom command"
                  className="cursor-pointer rounded p-1 text-ctp-peach transition-colors hover:bg-ctp-peach/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronLeftIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => stepSection(1)}
                  disabled={activeSectionIndex === customSections.length - 1}
                  aria-label="Next custom command"
                  className="cursor-pointer rounded p-1 text-ctp-peach transition-colors hover:bg-ctp-peach/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronRightIcon size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <LoaderCircleIcon
                size={28}
                className="animate-spin text-ctp-subtext0"
                aria-label="Loading config"
              />
            </div>
          )}

          {error && (
            <div className="text-ctp-red bg-ctp-red/10 rounded-lg p-4">
              {error}
            </div>
          )}

          {data && (
            <>
              {data.hasCustomCommands && (
                <div className="mb-4 p-4 bg-ctp-peach/10 border border-ctp-peach rounded-lg">
                  <div className="flex items-start gap-3">
                    <TriangleAlertIcon className="text-ctp-peach" />
                    <div>
                      <h3 className="font-semibold text-ctp-peach">
                        Custom Commands Detected
                      </h3>
                      <p className="text-ctp-subtext1 text-sm mt-1">
                        This theme contains{" "}
                        <code className="bg-ctp-surface0 px-1 rounded">
                          [custom.*]
                        </code>{" "}
                        sections that can execute arbitrary shell commands on
                        your system. Review the config carefully before
                        applying.
                      </p>
                      {customSections.length === 0 && (
                        <p className="text-ctp-subtext1 text-sm mt-2">
                          They are declared in a form this viewer cannot point
                          at directly (an inline table or a dotted key rather
                          than a{" "}
                          <code className="bg-ctp-surface0 px-1 rounded">
                            [custom.*]
                          </code>{" "}
                          heading), so nothing is highlighted below - read the
                          whole config.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="relative">
                <pre className="bg-ctp-base rounded-lg p-4 overflow-x-auto text-sm font-mono text-ctp-text border border-ctp-surface0">
                  <HighlightedConfig
                    configContent={data.configContent}
                    sections={customSections}
                    activeSectionIndex={activeSectionIndex}
                    sectionRefs={sectionRefs}
                    tokens={tokens}
                  />
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {data && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ctp-surface0">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-ctp-surface0 border-2 border-ctp-surface1 text-ctp-text rounded-lg flex items-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckIcon className="text-ctp-green" size={16} />
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon size={16} />
                  Copy to Clipboard
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-ctp-text border-2 border-ctp-subtext0 text-ctp-crust rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
