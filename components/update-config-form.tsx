"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Input from "./input";

interface LatestVersion {
  version: string;
  dependencies: string[] | null;
  minStarshipVersion: string;
}

interface UpdateConfigFormProps {
  themeId: string;
  themeName: string;
  latestVersion: LatestVersion;
  onCancel: () => void;
}

function calculateNextVersion(
  current: string,
  type: "minor" | "patch",
): string {
  const [minor, patch] = current.split(".").map(Number);

  if (type === "minor") {
    return `${minor + 1}.0`;
  } else {
    return `${minor}.${patch + 1}`;
  }
}

export default function UpdateConfigForm({
  themeId,
  themeName,
  latestVersion,
  onCancel,
}: UpdateConfigFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [versionType, setVersionType] = useState<"minor" | "patch">("minor");

  const nextVersion = calculateNextVersion(latestVersion.version, versionType);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("version", nextVersion);

    const response = await fetch(`/api/themes/${themeId}/config`, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      router.refresh();
      onCancel();
    } else {
      const error = await response.json();
      alert(`Update failed: ${error.error || "Unknown error"}`);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-ctp-base rounded-lg border border-ctp-surface0 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-semibold text-ctp-text mb-2">
          Update Config: {themeName}
        </h3>
        <p className="text-ctp-subtext0 mb-6">
          Current version: {latestVersion.version}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Version Type Selection */}
          <div>
            <span className="block text-sm font-medium text-ctp-text mb-2">
              Version Bump
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVersionType("minor")}
                className={`flex-1 px-4 py-2 rounded-md border transition ${
                  versionType === "minor"
                    ? "bg-ctp-text text-ctp-base border-2 border-ctp-subtext0"
                    : "bg-ctp-surface0 text-ctp-text border-2 border-ctp-surface1 hover:bg-ctp-surface1"
                }`}
              >
                Minor ({calculateNextVersion(latestVersion.version, "minor")})
              </button>
              <button
                type="button"
                onClick={() => setVersionType("patch")}
                className={`flex-1 px-4 py-2 rounded-md border transition ${
                  versionType === "patch"
                    ? "bg-ctp-text text-ctp-base border-2 border-ctp-subtext0"
                    : "bg-ctp-surface0 text-ctp-text border-2 border-ctp-surface1 hover:bg-ctp-surface1"
                }`}
              >
                Patch ({calculateNextVersion(latestVersion.version, "patch")})
              </button>
            </div>
            <p className="text-xs text-ctp-subtext0 mt-2">
              <span className="text-ctp-text">Minor:</span> New features,
              improvements • <span className="text-ctp-text">Patch:</span> Small
              fixes
              <br />
              For breaking changes, major redesigns, please create a new theme
            </p>
          </div>

          {/* Starship Config */}
          <div>
            <label className="flex flex-col">
              <span className="mb-1.5 text-sm text-ctp-text">
                New Starship Config (TOML)
              </span>
              <textarea
                name="config"
                rows={12}
                required
                className="p-3 rounded-lg text-xs font-mono bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0"
                placeholder={`[character]
success_symbol = '[➜](bold green)'
...`}
              />
            </label>
          </div>

          {/* Min Starship Version */}
          <div>
            <Input
              type="text"
              name="minStarshipVersion"
              label="Minimum Starship Version"
              defaultValue={latestVersion.minStarshipVersion}
              required
              pattern="^\d+\.\d+\.\d+$"
              placeholder="1.24.0"
            />
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
                defaultValue={latestVersion.dependencies?.join("\n") || ""}
                className="p-2 rounded-lg text-sm bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0"
                placeholder={`FiraCode Nerd Font
JetBrainsMono Nerd Font`}
              />
            </label>
          </div>

          {/* Version Notes */}
          <div>
            <label className="flex flex-col">
              <span className="mb-1.5 text-sm text-ctp-text">
                Version Notes
              </span>
              <textarea
                name="versionNotes"
                rows={2}
                className="p-2 rounded-lg text-sm bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0"
                placeholder="What's new in this version..."
              />
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-md border-2 border-ctp-surface1 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-ctp-text hover:bg-ctp-subtext1 text-ctp-base rounded-md border-2 border-ctp-subtext0 transition disabled:opacity-50"
            >
              {loading ? "Publishing..." : `Publish v${nextVersion}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
