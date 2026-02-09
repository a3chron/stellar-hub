"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Input from "./input";

interface UploadFormProps {
  colorSchemes: Array<{ id: string; name: string }>;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function UploadForm({ colorSchemes }: UploadFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [themeName, setThemeName] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const { slug, author } = await response.json();
      router.push(`/${author}/${slug}`);
    } else {
      const error = await response.json();
      alert(`Upload failed: ${error.error || "Unknown error"}`);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {/* Slug (auto-generated but editable) */}
      <div>
        <Input
          type="text"
          name="slug"
          value={generateSlug(themeName)}
          readOnly
          label="Slug (read only)"
          className="focus:ring-0!"
          placeholder="my-awesome-theme"
        />
        <p className="text-xs text-ctp-subtext0 mt-1">
          Used in URLs. Only lowercase letters, numbers, and hyphens.
          Auto-generated from name.
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
      </div>

      {/* Color Scheme */}
      <div>
        <label className="flex flex-col">
          <span className="mb-1.5 text-sm text-ctp-text">
            Color Scheme (optional)
          </span>
          <select
            name="colorSchemeId"
            className="p-2 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
          >
            <option value="">None</option>
            {colorSchemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-ctp-subtext0 mt-1">
          Select if your theme is based on a popular color scheme (Catppuccin,
          Gruvbox, etc.)
        </p>
      </div>

      {/* Group */}
      <div>
        <Input
          type="text"
          name="group"
          label="Group (optional)"
          placeholder="e.g., 'variants' or 'seasons'"
        />
        <p className="text-xs text-ctp-subtext0 mt-1">
          Group related themes together (e.g., different color variants of the
          same theme)
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
        <p className="text-xs text-ctp-subtext0 mt-1">
          Minimum Starship version required for this theme
        </p>
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
            className="p-3 rounded-lg text-sm font-mono bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
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
          One dependency per line (usually Nerd Fonts)
        </p>
      </div>

      {/* Installation Notes */}
      <div>
        <label className="flex flex-col">
          <span className="mb-1.5 text-sm text-ctp-text">
            Installation Notes (optional)
          </span>
          <textarea
            name="installationNotes"
            rows={3}
            className="p-2 rounded-lg text-sm bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
            placeholder="Any special installation instructions..."
          />
        </label>
      </div>

      {/* Version */}
      <div>
        <Input
          type="text"
          name="version"
          label="Version"
          required
          defaultValue="1.0"
          pattern="^v?\d+\.\d+$"
          placeholder="1.0 or v1.0"
        />
        <p className="text-xs text-ctp-subtext0 mt-1">
          Format: 1.0 or v1.0 (major.minor)
        </p>
      </div>

      {/* Version Notes */}
      <div>
        <label className="flex flex-col">
          <span className="mb-1.5 text-sm text-ctp-text">
            Version Notes (optional)
          </span>
          <textarea
            name="versionNotes"
            rows={2}
            className="p-2 rounded-lg text-sm bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
            placeholder="What's new in this version..."
          />
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-ctp-text hover:bg-ctp-subtext1 border-2 border-ctp-subtext0 text-ctp-base py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Uploading..." : "Publish Theme"}
      </button>
    </form>
  );
}
