"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { TomlEditor } from "@/components/toml/toml-editor";
import type { ThemeVersion } from "@/lib/db/types";
import { useConfirmClose } from "@/lib/use-confirm-close";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning";
import Input from "./input";
import Modal from "./modal";

type LatestVersion = Pick<
  ThemeVersion,
  "version" | "configContent" | "dependencies" | "minStarshipVersion"
>;

interface UpdateConfigFormProps {
  author: string;
  themeSlug: string;
  themeName: string;
  latestVersion: LatestVersion;
  onCancel: () => void;
}

/** Mirrors the split/trim/filter the server applies when it parses the
 * dependencies textarea (see app/api/upload/route.ts), so comparing the
 * submitted text against the stored value isn't tripped up by a stray blank
 * line or trailing whitespace that wouldn't actually change what gets
 * saved. */
function normalizeDependencies(text: string): string {
  return text
    .split("\n")
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .join("\n");
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
  author,
  themeSlug,
  themeName,
  latestVersion,
  onCancel,
}: UpdateConfigFormProps) {
  const router = useRouter();
  const titleId = useId();
  const configId = useId();
  const [loading, setLoading] = useState(false);
  const [versionType, setVersionType] = useState<"minor" | "patch">("minor");
  const [config, setConfig] = useState(latestVersion.configContent);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useUnsavedChangesWarning(dirty);

  // The screenshot field doesn't exist on this form - the only edit worth
  // confirming a discard for is a rewritten config.
  const configChanged = config !== latestVersion.configContent;
  const { confirming, requestClose, confirmDiscard, cancelDiscard } =
    useConfirmClose(configChanged, onCancel);

  // Moves focus to the confirm view's primary action when it appears, and
  // back to the control that triggered it once it's dismissed, since the
  // form below stays mounted (just hidden) rather than being swapped out -
  // nothing unmounts to carry focus away on its own. Skips the very first
  // render so mount doesn't fight Modal's own initial-focus effect.
  const keepEditingButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isFirstConfirmRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstConfirmRenderRef.current) {
      isFirstConfirmRenderRef.current = false;
      return;
    }
    if (confirming) {
      keepEditingButtonRef.current?.focus();
    } else {
      cancelButtonRef.current?.focus();
    }
  }, [confirming]);

  const nextVersion = calculateNextVersion(latestVersion.version, versionType);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Blocks the publish only when *nothing* on the form actually changed -
    // previously this compared the config alone, so a version bump that only
    // updated the minimum Starship version or the dependency list (config
    // left untouched) was rejected as "no changes" even though it was a real
    // edit.
    const configUnchanged =
      config.trim() === latestVersion.configContent.trim();
    const minStarshipVersionUnchanged =
      String(formData.get("minStarshipVersion") ?? "").trim() ===
      latestVersion.minStarshipVersion.trim();
    const dependenciesUnchanged =
      normalizeDependencies(String(formData.get("dependencies") ?? "")) ===
      normalizeDependencies(latestVersion.dependencies?.join("\n") ?? "");

    if (
      configUnchanged &&
      minStarshipVersionUnchanged &&
      dependenciesUnchanged
    ) {
      setError(
        "No changes to publish - update the config, dependencies, or minimum Starship version first",
      );
      return;
    }

    setLoading(true);

    formData.set("version", nextVersion);

    try {
      const response = await fetch(
        `/api/${author}/${themeSlug}/${nextVersion}`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.ok) {
        setDirty(false);
        router.refresh();
        onCancel();
        return;
      }

      // A proxy error page isn't JSON, and letting the parse throw would
      // strand the button on "Publishing...".
      const body = await response.json().catch(() => null);
      setError(
        body?.details?.[0]?.message ??
          body?.error ??
          `Update failed (${response.status})`,
      );
    } catch {
      setError(
        "Could not reach the server. Your changes are still here - check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      titleId={titleId}
      onRequestClose={confirming ? cancelDiscard : requestClose}
    >
      {/* Rendered as a sibling of the form rather than swapped in for it, so
          the form (and its uncontrolled fields - min Starship version,
          dependencies, version notes) stays mounted underneath instead of
          losing its state when the user backs out of discarding. */}
      {confirming && (
        <div>
          <h3 id={titleId} className="text-xl font-semibold text-ctp-text mb-2">
            Discard your changes?
          </h3>
          <p className="text-sm text-ctp-subtext0 mb-6">
            Your edits to the config haven't been published yet.
          </p>
          <div className="flex gap-3">
            <button
              ref={keepEditingButtonRef}
              type="button"
              onClick={cancelDiscard}
              className="flex-1 px-4 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-md border-2 border-ctp-surface1 transition"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={confirmDiscard}
              className="flex-1 px-4 py-2 bg-ctp-red text-ctp-crust rounded-md border-2 border-ctp-red transition hover:opacity-90"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className={confirming ? "hidden" : undefined}>
        <h3
          id={confirming ? undefined : titleId}
          className="text-2xl font-semibold text-ctp-text mb-2"
        >
          Update Config: {themeName}
        </h3>
        <p className="text-ctp-subtext0 mb-6">
          Current version: {latestVersion.version}
        </p>

        <form
          onSubmit={handleSubmit}
          onInput={() => setDirty(true)}
          className="space-y-4"
        >
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
            <label htmlFor={configId} className="flex flex-col">
              <span className="mb-1.5 text-sm text-ctp-text">
                New Starship Config (TOML)
              </span>
              <TomlEditor
                id={configId}
                name="config"
                value={config}
                onChange={setConfig}
                rows={12}
                required
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

          {error && (
            <p
              role="alert"
              className="text-sm text-ctp-red border-2 border-ctp-red/40 bg-ctp-mantle rounded-lg p-3"
            >
              {error}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={requestClose}
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
    </Modal>
  );
}
