"use client";

import {
  ArrowRight as ArrowRightIcon,
  Search as SearchIcon,
  User as UserIcon,
  X as XIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Theme, User } from "@/lib/db/types";
import { cn, formatDownloads } from "@/lib/utils";

type ThemeResult = Pick<Theme, "id" | "name" | "slug" | "downloads"> & {
  author: Pick<User, "username" | "name">;
};

type AuthorResult = Pick<User, "id" | "name" | "username" | "image">;

interface SearchResponse {
  themes: ThemeResult[];
  authors: AuthorResult[];
}

type SearchItem =
  | { type: "theme"; theme: ThemeResult }
  | { type: "author"; author: AuthorResult }
  | { type: "see-all"; query: string };

const SEARCH_DEBOUNCE_MS = 300;

function SearchResultRow({
  id,
  active,
  onMouseEnter,
  onClick,
  children,
}: {
  id: string;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left",
        active && "bg-ctp-surface0",
      )}
    >
      {children}
    </button>
  );
}

function renderItemContent(item: SearchItem) {
  if (item.type === "theme") {
    return (
      <>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-ctp-text">
            {item.theme.name}
          </span>
          <span className="truncate text-xs text-ctp-subtext0">
            by {item.theme.author.name}
          </span>
        </div>
        <span className="shrink-0 text-xs text-ctp-overlay0">
          {formatDownloads(item.theme.downloads)}
        </span>
      </>
    );
  }

  if (item.type === "author") {
    return (
      <>
        <div className="flex min-w-0 items-center gap-2">
          {item.author.image ? (
            <Image
              src={item.author.image}
              alt=""
              width={20}
              height={20}
              unoptimized
              className="h-5 w-5 shrink-0 rounded-full"
            />
          ) : (
            <UserIcon size={16} className="shrink-0 text-ctp-subtext0" />
          )}
          <span className="truncate text-sm text-ctp-text">
            {item.author.name}
          </span>
        </div>
        <span className="shrink-0 text-xs text-ctp-overlay0">
          @{item.author.username}
        </span>
      </>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm text-ctp-lavender">
      <ArrowRightIcon size={14} />
      See all theme results for &quot;{item.query}&quot;
    </span>
  );
}

/**
 * Nav's Ctrl+K / Cmd+K quick search: a dialog that queries GET /api/search
 * for a handful of matching themes and authors, plus a trailing item that
 * takes the full query to the gallery's own search (`/?q=...#themes`).
 */
export default function QuickSearch() {
  const router = useRouter();
  const listboxId = useId();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [isMac, setIsMac] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  // Global shortcut to open, and Escape to close - both work no matter what
  // element on the page currently has focus.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isShortcut =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isShortcut) {
        e.preventDefault();
        // Don't stack this dialog on top of another one (e.g. a settings
        // modal or the config preview, both `aria-modal`) - closing this one
        // later would restore `overflow` to whatever it was while that other
        // modal was open, and Escape would need to close both.
        if (!open && document.querySelector('[aria-modal="true"]')) {
          return;
        }
        setOpen(true);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Lock background scroll and manage focus while the dialog is open;
  // restore both when it closes.
  useEffect(() => {
    if (!open) {
      return;
    }
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  // Reset the dialog's own state once it closes, so reopening it starts
  // from a clean slate rather than the last query's results.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      setError(false);
      setHighlightIndex(0);
      abortRef.current?.abort();
    }
  }, [open]);

  // Debounced, abortable fetch against the quick-search endpoint.
  useEffect(() => {
    if (!open) {
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      // Nothing to show for an empty query, but there may still be a fetch
      // in flight from the last non-empty one (e.g. it landed before the
      // debounce below fired) - without aborting it, its response can still
      // resolve and repopulate `results` for a query that's no longer there.
      abortRef.current?.abort();
      setResults(null);
      setError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            // Most commonly a 429 `{ error }` body from the rate limiter -
            // definitely not a `SearchResponse`, so this has to be handled
            // before the body is even parsed as one.
            throw new Error(`Search failed with status ${res.status}`);
          }
          return (await res.json()) as SearchResponse;
        })
        .then((data) => {
          setResults(data);
          setLoading(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults(null);
            setError(true);
            setLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      // Cancel whatever this query's fetch was doing before the next
      // query's effect run gets a chance to start its own - otherwise a
      // superseded request can still resolve and render a stale result set,
      // or Enter can navigate to an item from it.
      abortRef.current?.abort();
    };
  }, [query, open]);

  const trimmedQuery = query.trim();
  const items: SearchItem[] = [];
  if (results && !error) {
    // Defensive on top of the `res.ok` check above: an unexpected response
    // shape shouldn't crash the nav by iterating `undefined`.
    for (const theme of results?.themes ?? []) {
      items.push({ type: "theme", theme });
    }
    for (const author of results?.authors ?? []) {
      items.push({ type: "author", author });
    }
  }
  if (trimmedQuery && !error) {
    items.push({ type: "see-all", query: trimmedQuery });
  }

  // Keep the highlight in range whenever the result set changes shape. The
  // effect body doesn't read `results`/`trimmedQuery` itself, so the linter
  // sees them as unnecessary - but they're exactly what should trigger the
  // reset (a new query shouldn't inherit the previous one's highlight).
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    setHighlightIndex(0);
  }, [results, trimmedQuery]);

  function navigateToItem(item: SearchItem) {
    setOpen(false);
    if (item.type === "theme") {
      router.push(`/${item.theme.author.username}/${item.theme.slug}`);
    } else if (item.type === "author") {
      router.push(`/${item.author.username}`);
    } else {
      router.push(`/?q=${encodeURIComponent(item.query)}#themes`);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (items.length === 0) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[highlightIndex];
      if (item) {
        navigateToItem(item);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-ctp-surface0 bg-ctp-base px-2.5 py-1.5 text-ctp-subtext1 transition hover:border-ctp-surface1 hover:text-ctp-text"
      >
        <SearchIcon size={18} />
        <span className="hidden text-sm font-medium sm:inline">Search</span>
        <kbd className="hidden rounded border border-ctp-surface1 bg-ctp-mantle px-1.5 py-0.5 font-mono text-xs text-ctp-subtext0 sm:inline">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search themes and authors"
          className="fixed inset-0 z-50 flex items-start justify-center bg-ctp-crust/80 px-4 pt-24 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOpen(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        >
          <div className="flex max-h-[70vh] w-full max-w-xl flex-col rounded-lg border border-ctp-surface0 bg-ctp-mantle shadow-xl">
            <div className="flex items-center gap-3 border-b border-ctp-surface0 px-4 py-3">
              <SearchIcon size={18} className="shrink-0 text-ctp-subtext0" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={items.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  items[highlightIndex]
                    ? `${listboxId}-${highlightIndex}`
                    : undefined
                }
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search themes and authors..."
                className="flex-1 bg-transparent text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="shrink-0 cursor-pointer text-ctp-subtext0 transition hover:text-ctp-text"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div
              id={listboxId}
              role="listbox"
              aria-label="Search results"
              className="flex-1 overflow-y-auto p-2"
            >
              {loading && (
                <p className="px-3 py-6 text-center text-sm text-ctp-subtext0">
                  Searching…
                </p>
              )}

              {!loading && error && (
                <p className="px-3 py-6 text-center text-sm text-ctp-subtext0">
                  Search is busy, try again in a moment.
                </p>
              )}

              {!loading && !error && !trimmedQuery && (
                <p className="px-3 py-6 text-center text-sm text-ctp-subtext0">
                  Search for a theme, author, or handle.
                </p>
              )}

              {!loading && !error && trimmedQuery && items.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-ctp-subtext0">
                  No results for &quot;{trimmedQuery}&quot;
                </p>
              )}

              {!loading &&
                !error &&
                items.map((item, index) => {
                  const optionId = `${listboxId}-${index}`;
                  const previousType = index > 0 ? items[index - 1].type : null;

                  let header: string | null = null;
                  if (item.type === "theme" && previousType !== "theme") {
                    header = "Themes";
                  } else if (
                    item.type === "author" &&
                    previousType !== "author"
                  ) {
                    header = "Authors";
                  }

                  return (
                    <div key={optionId}>
                      {header && (
                        <p className="px-3 pt-2 pb-1 text-xs font-medium text-ctp-overlay0 uppercase">
                          {header}
                        </p>
                      )}
                      <SearchResultRow
                        id={optionId}
                        active={index === highlightIndex}
                        onMouseEnter={() => setHighlightIndex(index)}
                        onClick={() => navigateToItem(item)}
                      >
                        {renderItemContent(item)}
                      </SearchResultRow>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
