"use client";

import { InfoIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Tooltip from "./tooltip";

interface ThemeFiltersProps {
  colorSchemes: Array<{ id: string; name: string }>;
}

export default function ThemeFilters({ colorSchemes }: ThemeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort") || "downloads";
  const currentColorScheme = searchParams.get("colorScheme") || "";

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sort);
    router.push(`/?${params.toString()}`);
  };

  const handleColorSchemeChange = (colorSchemeId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (colorSchemeId) {
      params.set("colorScheme", colorSchemeId);
    } else {
      params.delete("colorScheme");
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
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
          <Tooltip content="Themes with most downloads, created in the last 30d">
            <InfoIcon size={16} />
          </Tooltip>
        </button>
      </div>

      {/* Color Scheme Filter */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-ctp-overlay0 ml-1">Color scheme:</span>
        <select
          value={currentColorScheme}
          onChange={(e) => handleColorSchemeChange(e.target.value)}
          className="px-4 py-2 rounded-lg bg-ctp-mantle text-ctp-text text-sm font-medium border-2 border-ctp-crust focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
        >
          <option value="">All</option>
          {colorSchemes.map((scheme) => (
            <option key={scheme.id} value={scheme.id}>
              {scheme.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
