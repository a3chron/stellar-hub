"use client";

import { Check, Loader2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { TomlEditor } from "@/components/toml/toml-editor";
import {
  ACCEPTED_SCREENSHOT_TYPES,
  validateScreenshotFile,
} from "@/lib/screenshot-validation";
import {
  finishSlugInput,
  generateSlug,
  MAX_SLUG_LENGTH,
  sanitizeSlugInput,
} from "@/lib/theme-slug";
import {
  themeSlugAnnouncement,
  themeSlugError,
  themeSlugStateClass,
  useThemeSlugAvailability,
} from "@/lib/use-theme-slug-availability";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning";
import Input from "./input";
import Select from "./select";

interface UploadFormProps {
  colorSchemes: Array<{ id: string; name: string }>;
}

const DESCRIPTION_MAX_LENGTH = 500;

const MIN_STARSHIP_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

// Maps a zod issue's path to the label the field is shown under, so a raw
// message like "String must contain at most 500 character(s)" can read as
// "Description: must be at most 500 characters" instead.
const FIELD_LABELS: Record<string, string> = {
  name: "Theme Name",
  slug: "Slug",
  description: "Description",
  config: "Starship Config",
  version: "Version",
  minStarshipVersion: "Minimum Starship Version",
  colorSchemeId: "Color Scheme",
  colorMode: "Theme Mode",
  group: "Group",
  dependencies: "Dependencies",
  versionNotes: "Version Notes",
};

/** Rewrites a raw zod message into something a form field's own copy would say. */
function friendlyZodMessage(message: string): string {
  if (message === "Required") {
    return "is required";
  }

  const maxMatch = message.match(/at most (\d+) character/);
  if (maxMatch) {
    return `must be at most ${maxMatch[1]} characters`;
  }

  const minMatch = message.match(/at least (\d+) character/);
  if (minMatch) {
    return `must be at least ${minMatch[1]} characters`;
  }

  if (message.toLowerCase().includes("invalid")) {
    return "is invalid";
  }

  return message;
}

interface ZodIssueLike {
  path?: Array<string | number>;
  message: string;
}

function formatUploadIssue(issue: ZodIssueLike): string {
  const field = issue.path?.[0];
  const label =
    typeof field === "string" ? (FIELD_LABELS[field] ?? field) : "Value";
  return `${label}: ${friendlyZodMessage(issue.message)}`;
}

// Errors that link to /settings (a duplicate slug) need a real <Link>, so the
// error state carries a flag rather than being a plain string.
interface FormError {
  message: string;
  duplicateSlug?: boolean;
}

export default function UploadForm({ colorSchemes }: UploadFormProps) {
  const router = useRouter();
  const configId = useId();
  const [loading, setLoading] = useState(false);
  const [themeName, setThemeName] = useState("");
  const [description, setDescription] = useState("");
  const [minStarshipVersion, setMinStarshipVersion] = useState("");
  const [minStarshipVersionTouched, setMinStarshipVersionTouched] =
    useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<FormError | null>(null);
  const [dirty, setDirty] = useState(false);

  // A stray Ctrl+R here costs the user their pasted starship config.
  useUnsavedChangesWarning(dirty);

  // The slug follows the name until the user edits it by hand; from then on
  // it is theirs, and renaming the theme no longer overwrites it. Clearing
  // the field hands it back to the generator.
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const slug = customSlug ?? generateSlug(themeName);
  const slugId = useId();
  const descriptionId = useId();
  const minStarshipVersionId = useId();
  const slugAvailability = useThemeSlugAvailability(themeName, slug, true);
  const slugProblem = themeSlugError(slugAvailability);
  const slugClass = themeSlugStateClass(slugAvailability) ?? "";

  const minStarshipVersionInvalid =
    minStarshipVersionTouched &&
    minStarshipVersion.length > 0 &&
    !MIN_STARSHIP_VERSION_PATTERN.test(minStarshipVersion);

  // Revokes the previous object URL whenever the preview changes (including
  // when a new file replaces it) and on unmount.
  useEffect(() => {
    if (!screenshotPreview) {
      return;
    }
    return () => URL.revokeObjectURL(screenshotPreview);
  }, [screenshotPreview]);

  function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) {
      setScreenshotError(null);
      setScreenshotPreview(null);
      return;
    }

    const validationError = validateScreenshotFile(file);
    if (validationError) {
      setScreenshotError(validationError);
      setScreenshotPreview(null);
      return;
    }

    setScreenshotError(null);
    setScreenshotPreview(URL.createObjectURL(file));
  }

  const submitDisabled =
    loading ||
    slugAvailability.state === "empty" ||
    slugAvailability.state === "unavailable" ||
    screenshotError !== null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Auto-set version to 1.0 for new themes
    formData.set("version", "1.0");
    // Enter submits without blurring the slug field, so tidy its ends here too.
    formData.set("slug", finishSlugInput(slug));

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      // An error page from a proxy (a 413 on a large screenshot, say) isn't
      // JSON, and letting the parse throw would strand the button on
      // "Publishing...".
      const body = await response.json().catch(() => null);

      if (response.ok && body?.slug) {
        // Cleared before navigating, or the leave-confirmation would fire on
        // our own redirect. Loading stays on so the button can't be
        // re-submitted while the route transition is in flight.
        setDirty(false);
        router.push(`/${body.author}/${body.slug}`);
        return;
      }

      if (body?.code === "duplicate_slug") {
        setError({
          message: body?.error ?? "This theme already exists.",
          duplicateSlug: true,
        });
      } else if (body?.details?.[0]) {
        setError({ message: formatUploadIssue(body.details[0]) });
      } else {
        setError({
          message: body?.error ?? `Upload failed (${response.status})`,
        });
      }
    } catch {
      setError({
        message:
          "Could not reach the server. Your input is still here - check your connection and try again.",
      });
    }

    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      onInput={() => setDirty(true)}
      className="space-y-6"
    >
      {/* Theme Name */}
      <div>
        <Input
          type="text"
          name="name"
          label="Theme Name"
          value={themeName}
          onChange={(e) => setThemeName(e.currentTarget.value)}
          required
          placeholder="My Awesome Theme"
        />
      </div>

      {/* Slug (generated from the name, editable) */}
      <div>
        <label htmlFor={slugId} className="flex flex-col">
          <span className="mb-1.5 text-sm text-ctp-text">Slug</span>
          <div className="relative">
            <input
              id={slugId}
              type="text"
              name="slug"
              value={slug}
              onChange={(e) => {
                const next = sanitizeSlugInput(e.currentTarget.value);
                setCustomSlug(next === "" ? null : next);
              }}
              onBlur={() => {
                if (customSlug !== null) {
                  const finished = finishSlugInput(customSlug);
                  setCustomSlug(finished === "" ? null : finished);
                }
              }}
              maxLength={MAX_SLUG_LENGTH}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={slugProblem !== null}
              aria-describedby={`${slugId}-hint`}
              className={`w-full p-2 pr-9 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base ${slugClass}`}
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {slugAvailability.state === "checking" && (
                <Loader2 size={16} className="animate-spin text-ctp-overlay0" />
              )}
              {slugAvailability.state === "available" && (
                <Check size={16} className="text-ctp-green" />
              )}
              {slugProblem && <X size={16} className="text-ctp-red" />}
            </span>
            <span className="sr-only" aria-live="polite">
              {themeSlugAnnouncement(slugAvailability)}
            </span>
          </div>
        </label>
        <p id={`${slugId}-hint`} className="text-xs text-ctp-subtext0 mt-1">
          {slugProblem ? (
            <span className="text-ctp-red">
              {slugProblem}
              {slugAvailability.state === "unavailable" && (
                <>
                  {" "}
                  <Link href="/settings" className="underline">
                    Manage your themes in settings
                  </Link>
                  .
                </>
              )}
            </span>
          ) : (
            <>
              Your theme's address and{" "}
              <code className="text-ctp-subtext1">stellar apply</code> name.
              Generated from the name - edit it if you like, but it can't be
              changed after publishing.
              {customSlug !== null && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => setCustomSlug(null)}
                    className="cursor-pointer text-ctp-lavender underline underline-offset-2"
                  >
                    Use generated slug
                  </button>
                </>
              )}
            </>
          )}
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="flex flex-col">
          <span className="mb-1.5 text-sm text-ctp-text">Description</span>
          <textarea
            id={descriptionId}
            name="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            maxLength={DESCRIPTION_MAX_LENGTH}
            aria-describedby={`${descriptionId}-count`}
            className="p-2 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
            placeholder="A brief description of your theme..."
          />
        </label>
        <p className="text-xs text-ctp-subtext0 mt-1 flex justify-between">
          <span>Supports markdown</span>
          <span id={`${descriptionId}-count`}>
            {description.length}/{DESCRIPTION_MAX_LENGTH} characters
          </span>
        </p>
      </div>

      {/* Color Mode */}
      <div>
        <Select
          name="colorMode"
          label="Theme Mode"
          defaultValue="dark"
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
            { value: "both", label: "Dark & Light" },
          ]}
        />
      </div>

      {/* Color Scheme */}
      <div>
        <Select
          name="colorSchemeId"
          label="Color Scheme (optional)"
          defaultValue=""
          options={[
            { value: "", label: "None" },
            ...colorSchemes.map((scheme) => ({
              value: scheme.id,
              label: scheme.name,
            })),
          ]}
        />
      </div>

      {/* Group */}
      <div>
        <Input
          type="text"
          name="group"
          label="Group (optional)"
          placeholder="e.g., 'seasons'"
        />
        <p className="text-xs text-ctp-subtext0 mt-1">
          Group related themes together (e.g., different color variants of the
          same theme, like catppuccin flavors / accents)
        </p>
      </div>

      {/* Min Starship Version */}
      <div>
        <Input
          type="text"
          name="minStarshipVersion"
          label="Minimum Starship Version (optional)"
          value={minStarshipVersion}
          onChange={(e) => setMinStarshipVersion(e.currentTarget.value)}
          onBlur={() => setMinStarshipVersionTouched(true)}
          pattern="^\d+\.\d+\.\d+$"
          placeholder="1.24.0"
          aria-invalid={minStarshipVersionInvalid}
          aria-describedby={
            minStarshipVersionInvalid
              ? `${minStarshipVersionId}-hint`
              : undefined
          }
          className={
            minStarshipVersionInvalid
              ? "border-ctp-red! focus:ring-ctp-red/30!"
              : undefined
          }
        />
        {minStarshipVersionInvalid && (
          <p
            id={`${minStarshipVersionId}-hint`}
            className="text-xs text-ctp-red mt-1"
          >
            Expected format: X.Y.Z (e.g. 1.24.0)
          </p>
        )}
      </div>

      {/* Screenshot */}
      <div>
        <label className="flex flex-col text-sm text-ctp-text mb-2">
          Screenshot
          <input
            type="file"
            name="screenshot"
            accept={ACCEPTED_SCREENSHOT_TYPES.join(",")}
            onChange={handleScreenshotChange}
            required
            aria-invalid={screenshotError !== null}
            className="w-fit bg-ctp-mantle border-2 border-ctp-crust p-2 px-4 rounded-lg mt-1.5 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base text-ctp-text file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-ctp-surface0 file:text-ctp-text"
          />
        </label>
        {screenshotError ? (
          <p className="text-xs text-ctp-red mt-1">{screenshotError}</p>
        ) : (
          <p className="text-xs text-ctp-subtext0 mt-1">
            PNG, JPG, or WebP. Max 5MB.
          </p>
        )}
        {screenshotPreview && (
          <div className="relative w-full h-48 rounded-lg overflow-hidden bg-ctp-surface0 border-2 border-ctp-surface0 mt-2">
            <Image
              src={screenshotPreview}
              alt="Screenshot preview"
              fill
              className="object-cover object-top-left"
            />
          </div>
        )}
      </div>

      {/* Starship Config */}
      <div>
        <label htmlFor={configId} className="flex flex-col">
          <span className="mb-1.5 text-sm text-ctp-text">
            Starship Config (TOML)
          </span>
          <TomlEditor
            id={configId}
            name="config"
            rows={12}
            required
            placeholder={`[character]
success_symbol = '[➜](bold green)'
error_symbol = '[✗](bold red)'

[directory]
style = "blue"
truncation_length = 3
...`}
          />
        </label>
        <p className="text-xs text-ctp-subtext0 mt-1">
          Paste your complete starship.toml configuration
        </p>
      </div>

      {/* Dependencies */}
      <div>
        <label className="flex flex-col">
          <span className="mb-1.5 text-sm text-ctp-text">
            Dependencies (optional)
          </span>
          <textarea
            name="dependencies"
            rows={3}
            className="p-2 rounded-lg text-sm bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
            placeholder={`FiraCode Nerd Font
JetBrainsMono Nerd Font`}
          />
        </label>
        <p className="text-xs text-ctp-subtext0 mt-1">
          One per line (usually Nerd Fonts)
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-ctp-red border-2 border-ctp-red/40 bg-ctp-mantle rounded-lg p-3"
        >
          {error.message}
          {error.duplicateSlug && (
            <>
              {" "}
              <Link href="/settings" className="underline">
                Update your themes in settings
              </Link>
              .
            </>
          )}
        </p>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitDisabled}
        className="w-full bg-ctp-text hover:bg-ctp-subtext1 border-2 border-ctp-subtext0 text-ctp-base py-3 rounded-lg font-semibold transition disabled:opacity-50"
      >
        {loading ? "Publishing..." : "Publish Theme"}
      </button>
    </form>
  );
}
