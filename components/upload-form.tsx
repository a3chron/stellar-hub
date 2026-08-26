"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning";
import Input from "./input";
import Select from "./select";

interface UploadFormProps {
  colorSchemes: Array<{ id: string; name: string }>;
}

// Matches the slug column's own limit (see /api/upload): a longer slug is
// rejected server-side, and the user can't edit this field to shorten it.
const MAX_SLUG_LENGTH = 50;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-$/, "");
}

export default function UploadForm({ colorSchemes }: UploadFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [themeName, setThemeName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // A stray Ctrl+R here costs the user their pasted starship config.
  useUnsavedChangesWarning(dirty);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Auto-set version to 1.0 for new themes
    formData.set("version", "1.0");

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

      setError(
        body?.details?.[0]?.message ??
          body?.error ??
          `Upload failed (${response.status})`,
      );
    } catch {
      setError(
        "Could not reach the server. Your input is still here - check your connection and try again.",
      );
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

      {/* Slug (auto-generated, read-only) */}
      <div>
        <Input
          type="text"
          name="slug"
          value={generateSlug(themeName)}
          readOnly
          label="Slug (auto-generated)"
          className="focus:ring-0!"
        />
        <p className="text-xs text-ctp-subtext0 mt-1">
          Used in URLs. Auto-generated from theme name.
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="flex flex-col">
          <span className="mb-1.5 text-sm text-ctp-text">Description</span>
          <textarea
            name="description"
            rows={3}
            className="p-2 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
            placeholder="A brief description of your theme..."
          />
        </label>
        <p className="text-xs text-ctp-subtext0 mt-1">Supports markdown</p>
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
          label="Minimum Starship Version"
          defaultValue="1.24.0"
          required
          pattern="^\d+\.\d+\.\d+$"
          placeholder="1.24.0"
        />
      </div>

      {/* Screenshot */}
      <div>
        <label className="flex flex-col text-sm text-ctp-text mb-2">
          Screenshot
          <input
            type="file"
            name="screenshot"
            accept="image/png,image/jpeg,image/webp"
            required
            className="w-fit bg-ctp-mantle border-2 border-ctp-crust p-2 px-4 rounded-lg mt-1.5 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base text-ctp-text file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-ctp-surface0 file:text-ctp-text"
          />
        </label>
        <p className="text-xs text-ctp-subtext0 mt-1">
          PNG, JPG, or WebP. Max 5MB.
        </p>
      </div>

      {/* Starship Config */}
      <div>
        <label className="flex flex-col">
          <span className="mb-1.5 text-sm text-ctp-text">
            Starship Config (TOML)
          </span>
          <textarea
            name="config"
            rows={12}
            required
            className="p-3 rounded-lg text-xs font-mono bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
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
            Prerequesites (optional)
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
          {error}
        </p>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-ctp-text hover:bg-ctp-subtext1 border-2 border-ctp-subtext0 text-ctp-base py-3 rounded-lg font-semibold transition disabled:opacity-50"
      >
        {loading ? "Publishing..." : "Publish Theme"}
      </button>
    </form>
  );
}
