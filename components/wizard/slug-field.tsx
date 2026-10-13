"use client";

import { Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import {
  finishSlugInput,
  MAX_SLUG_LENGTH,
  sanitizeSlugInput,
} from "@/lib/theme-slug";
import {
  type ThemeSlugAvailability,
  themeSlugAnnouncement,
  themeSlugError,
  themeSlugStateClass,
} from "@/lib/use-theme-slug-availability";

/**
 * The slug input: generated from the name until edited by hand, with the
 * live availability check against the user's themes and drafts.
 */
export default function SlugField({
  slug,
  isCustom,
  onCustomChange,
  availability,
}: {
  slug: string;
  isCustom: boolean;
  // null hands the slug back to the generator.
  onCustomChange: (slug: string | null) => void;
  availability: ThemeSlugAvailability;
}) {
  const slugId = useId();
  const problem = themeSlugError(availability);
  const stateClass = themeSlugStateClass(availability) ?? "";

  let hint: React.ReactNode;
  if (availability.state === "draft") {
    hint = (
      <span className="text-ctp-red">
        {problem}{" "}
        <Link href={`/upload/${availability.code}`} className="underline">
          Continue that draft
        </Link>{" "}
        or pick another slug.
      </span>
    );
  } else if (problem) {
    hint = (
      <span className="text-ctp-red">
        {problem}
        {availability.state === "unavailable" && (
          <>
            {" "}
            <Link href="/settings#themes" className="underline">
              Publish a new version of it from settings
            </Link>
            .
          </>
        )}
      </span>
    );
  } else {
    hint = (
      <>
        Your theme's address and{" "}
        <code className="text-ctp-subtext1">stellar apply</code> name. Generated
        from the name - edit it if you like, but it can't be changed after
        publishing.
        {isCustom && (
          <>
            {" "}
            <button
              type="button"
              onClick={() => onCustomChange(null)}
              className="cursor-pointer text-ctp-lavender underline underline-offset-2"
            >
              Use generated slug
            </button>
          </>
        )}
      </>
    );
  }

  return (
    <div>
      <label htmlFor={slugId} className="flex flex-col">
        <span className="mb-1.5 text-sm text-ctp-text">Slug</span>
        <div className="relative">
          <input
            id={slugId}
            type="text"
            value={slug}
            onChange={(e) => {
              const next = sanitizeSlugInput(e.currentTarget.value);
              onCustomChange(next === "" ? null : next);
            }}
            onBlur={() => {
              if (isCustom) {
                const finished = finishSlugInput(slug);
                onCustomChange(finished === "" ? null : finished);
              }
            }}
            maxLength={MAX_SLUG_LENGTH}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={problem !== null}
            aria-describedby={`${slugId}-hint`}
            className={`w-full p-2 pr-9 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base ${stateClass}`}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {availability.state === "checking" && (
              <Loader2 size={16} className="animate-spin text-ctp-overlay0" />
            )}
            {availability.state === "available" && (
              <Check size={16} className="text-ctp-green" />
            )}
            {problem && <X size={16} className="text-ctp-red" />}
          </span>
          <span className="sr-only" aria-live="polite">
            {themeSlugAnnouncement(availability)}
          </span>
        </div>
      </label>
      <p id={`${slugId}-hint`} className="text-xs text-ctp-subtext0 mt-1">
        {hint}
      </p>
    </div>
  );
}
