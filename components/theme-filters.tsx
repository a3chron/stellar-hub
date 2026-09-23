"use client";

import { Search as SearchIcon, X as XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Select from "./select";

type ColorMode = "dark" | "light" | "both";

interface ThemeFiltersProps {
  colorSchemes: Array<{ id: string; name: string }>;
}

// Debounce for the search input writing `?q=` to the URL, so a URL update
// (and the Suspense re-render it triggers) doesn't fire on every keystroke.
const SEARCH_DEBOUNCE_MS = 300;

export default function ThemeFilters({ colorSchemes }: ThemeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort") || "downloads";
  const currentColorScheme = searchParams.get("colorScheme") || "";
  const currentColorMode = (searchParams.get("colorMode") || "") as
    | ColorMode
    | "";
  const currentQuery = searchParams.get("q") || "";

  const [searchInput, setSearchInput] = useState(currentQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last value *this component* pushed into the `q` param, so the sync
  // effect below can tell "the URL changed because someone else changed it"
  // (back/forward, the "Clear filters" link) apart from "the URL caught up
  // with what I just typed". Without that distinction, pushSearch's trim
  // strips a trailing space the moment it lands, fighting anyone who pauses
  // after typing "catppuccin ", and a navigation that's still in flight
  // resets the input to its own stale pre-navigation value on every
  // keystroke typed in the meantime.
  const lastPushedRef = useRef(currentQuery);

  useEffect(() => {
    if (currentQuery === lastPushedRef.current) {
      return;
    }
    lastPushedRef.current = currentQuery;
    setSearchInput(currentQuery);
  }, [currentQuery]);

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  // A filter/sort change can turn a page-3 result set into "no themes
  // found" if the new filter has fewer matches than the current page
  // offset - so every handler below drops `page` along with setting its own
  // param, sending the user back to page 1 of the new result set.
  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sort);
    params.delete("page");
    router.push(`/?${params.toString()}#themes`);
  };

  const handleColorSchemeChange = (colorSchemeId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (colorSchemeId) {
      params.set("colorScheme", colorSchemeId);
    } else {
      params.delete("colorScheme");
    }
    params.delete("page");
    router.push(`/?${params.toString()}#themes`);
  };

  const handleColorModeChange = (mode: ColorMode | "") => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode) {
      params.set("colorMode", mode);
    } else {
      params.delete("colorMode");
    }
    params.delete("page");
    router.push(`/?${params.toString()}#themes`);
  };

  // Reads `window.location.search` rather than the `searchParams` hook value
  // closed over at call time: this fires from a `setTimeout` up to
  // `SEARCH_DEBOUNCE_MS` later, and by then a sort/filter click handled in
  // between has moved the URL on - pushing from the stale closure would
  // silently revert that change back out.
  //
  // Typing-driven pushes (the debounce firing, or the immediate push when
  // the field is cleared) use `replace` so every keystroke doesn't spam
  // history and re-scroll to `#themes`; Enter still does a real `push`.
  const pushSearch = (value: string, options: { replace?: boolean } = {}) => {
    const params = new URLSearchParams(window.location.search);
    const trimmed = value.trim();
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }
    params.delete("page");
    lastPushedRef.current = trimmed;
    const url = `/?${params.toString()}#themes`;
    if (options.replace) {
      router.replace(url);
    } else {
      router.push(url);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (!value.trim()) {
      // Clearing the field removes the filter right away instead of
      // waiting out the debounce.
      pushSearch("", { replace: true });
      return;
    }
    debounceRef.current = setTimeout(
      () => pushSearch(value, { replace: true }),
      SEARCH_DEBOUNCE_MS,
    );
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      pushSearch(searchInput);
    }
  };

  const colorModeOptions: Array<{ value: ColorMode | ""; label: string }> = [
    { value: "", label: "All" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "both", label: "Dark & Light" },
  ];

  return (
    <div className="flex flex-col gap-4 mb-8">
      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <SearchIcon
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ctp-overlay0"
        />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search themes..."
          aria-label="Search themes"
          className="w-full rounded-xl border-2 border-ctp-crust bg-ctp-mantle py-2.5 pr-9 pl-9 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 ring-offset-2 ring-offset-ctp-base focus:ring-ctp-surface0"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => handleSearchChange("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-ctp-overlay0 transition hover:text-ctp-text"
          >
            <XIcon size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Sort Options */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleSortChange("downloads")}
            className={`px-5 py-3 rounded-xl font-medium transition border-2 hover:ring-2 ring-offset-2 ring-offset-ctp-base cursor-pointer ${
              currentSort === "downloads"
                ? "bg-ctp-text text-ctp-base border-ctp-subtext0 hover:ring-ctp-surface1"
                : "bg-ctp-mantle text-ctp-text hover:ring-ctp-surface0 border-ctp-crust"
            }`}
          >
            Most Downloads
          </button>
          <button
            type="button"
            onClick={() => handleSortChange("latest")}
            className={`px-5 py-3 rounded-xl font-medium transition border-2 hover:ring-2 ring-offset-2 ring-offset-ctp-base cursor-pointer ${
              currentSort === "latest"
                ? "bg-ctp-text text-ctp-base border-ctp-subtext0 hover:ring-ctp-surface1"
                : "bg-ctp-mantle text-ctp-text hover:ring-ctp-surface0 border-ctp-crust"
            }`}
          >
            Latest
          </button>
          <button
            type="button"
            onClick={() => handleSortChange("trending")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition border-2 hover:ring-2 ring-offset-2 ring-offset-ctp-base cursor-pointer ${
              currentSort === "trending"
                ? "bg-ctp-text text-ctp-base border-ctp-subtext0 hover:ring-ctp-surface1"
                : "bg-ctp-mantle text-ctp-text hover:ring-ctp-surface0 border-ctp-crust"
            }`}
          >
            Trending
          </button>
        </div>

        {/* Right-side filters */}
        <div className="flex flex-wrap items-end gap-4">
          {/* Color Mode Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-ctp-overlay0 ml-1">Theme mode:</span>
            <div className="flex gap-2">
              {colorModeOptions.map(({ value, label }) => (
                <button
                  key={value || "all"}
                  type="button"
                  onClick={() => handleColorModeChange(value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition border-2 hover:ring-2 ring-offset-2 ring-offset-ctp-base cursor-pointer ${
                    currentColorMode === value
                      ? "bg-ctp-text text-ctp-base border-ctp-subtext0 hover:ring-ctp-surface1"
                      : "bg-ctp-mantle text-ctp-text hover:ring-ctp-surface0 border-ctp-crust"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Color Scheme Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-ctp-overlay0 ml-1">
              Color scheme:
            </span>
            <Select
              options={[
                { value: "", label: "All" },
                ...colorSchemes.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={currentColorScheme}
              onChange={handleColorSchemeChange}
              ariaLabel="Color scheme"
              className="min-w-36"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
