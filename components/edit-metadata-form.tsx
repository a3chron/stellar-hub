"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Theme } from "@/lib/db/types";
import {
  ACCEPTED_SCREENSHOT_TYPES,
  validateScreenshotFile,
} from "@/lib/screenshot-validation";
import { useConfirmClose } from "@/lib/use-confirm-close";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning";
import Input from "./input";
import Modal from "./modal";
import Select from "./select";

type EditableTheme = Pick<
  Theme,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "screenshotUrl"
  | "colorSchemeId"
  | "colorMode"
  | "group"
>;

interface EditMetadataFormProps {
  author: string;
  theme: EditableTheme;
  colorSchemes: Array<{ id: string; name: string }>;
  onCancel: () => void;
}

export default function EditMetadataForm({
  author,
  theme,
  colorSchemes,
  onCancel,
}: EditMetadataFormProps) {
  const router = useRouter();
  const titleId = useId();
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useUnsavedChangesWarning(dirty);

  // A new screenshot is the only edit worth confirming a discard for here -
  // text field tweaks close without a prompt.
  const { confirming, requestClose, confirmDiscard, cancelDiscard } =
    useConfirmClose(previewImage !== null, onCancel);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setScreenshotError(null);
      setPreviewImage(null);
      return;
    }

    // Same rules the server enforces (see lib/screenshot-validation and
    // app/api/[author]/[slug]/route.ts) - upload already validated on
    // selection, this form previously didn't and relied on the server to
    // reject a bad file after the round trip.
    const validationError = validateScreenshotFile(file);
    if (validationError) {
      setScreenshotError(validationError);
      setPreviewImage(null);
      return;
    }

    setScreenshotError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch(`/api/${author}/${theme.slug}`, {
        method: "PATCH",
        body: formData,
      });

      if (response.ok) {
        setDirty(false);
        router.refresh();
        onCancel();
        return;
      }

      // A proxy error page isn't JSON, and letting the parse throw would
      // strand the button on "Saving...".
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
    }

    setLoading(false);
  }

  return (
    <Modal
      titleId={titleId}
      onRequestClose={confirming ? cancelDiscard : requestClose}
    >
      {/* Rendered as a sibling of the form rather than swapped in for it, so
          the form (and its uncontrolled fields, including the selected
          screenshot file) stays mounted underneath instead of losing its
          state when the user backs out of discarding. */}
      {confirming && (
        <div>
          <h3 id={titleId} className="text-xl font-semibold text-ctp-text mb-2">
            Discard your changes?
          </h3>
          <p className="text-sm text-ctp-subtext0 mb-6">
            You selected a new screenshot that hasn't been saved yet.
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
          className="text-2xl font-semibold text-ctp-text mb-6"
        >
          Edit Metadata: {theme.name}
        </h3>

        <form
          onSubmit={handleSubmit}
          onInput={() => setDirty(true)}
          className="space-y-4"
        >
          {/* Theme Name */}
          <div>
            <Input
              type="text"
              name="name"
              label="Theme Name"
              defaultValue={theme.name}
              required
              placeholder="My Awesome Theme"
            />
          </div>

          {/* Description */}
          <div>
            <label className="flex flex-col">
              <span className="mb-1.5 text-sm text-ctp-text">Description</span>
              <textarea
                name="description"
                rows={3}
                defaultValue={theme.description || ""}
                className="p-2 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0"
                placeholder="A brief description..."
              />
            </label>
          </div>

          {/* Color Mode */}
          <div>
            <Select
              name="colorMode"
              label="Theme Mode"
              defaultValue={theme.colorMode}
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
              label="Color Scheme"
              defaultValue={theme.colorSchemeId || ""}
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
              defaultValue={theme.group || ""}
              placeholder="e.g., 'variants'"
            />
          </div>

          {/* Screenshot Update */}
          <div>
            <label className="flex flex-col text-sm text-ctp-text mb-2">
              Update Screenshot (optional)
              <input
                type="file"
                name="screenshot"
                accept={ACCEPTED_SCREENSHOT_TYPES.join(",")}
                onChange={handleImageChange}
                aria-invalid={screenshotError !== null}
                className="w-fit bg-ctp-mantle border-2 border-ctp-crust p-2 px-4 rounded-lg mt-1.5 text-ctp-text file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-ctp-surface0 file:text-ctp-text"
              />
            </label>
            {screenshotError && (
              <p className="text-xs text-ctp-red mt-1">{screenshotError}</p>
            )}

            {/* Current Screenshot */}
            <div className="mt-2">
              <p className="text-xs text-ctp-subtext0 mb-2">
                Current screenshot:
              </p>
              <div className="relative w-full h-48 rounded-lg overflow-hidden bg-ctp-surface0 border-2 border-ctp-surface0">
                <Image
                  src={previewImage || theme.screenshotUrl}
                  alt={theme.name}
                  fill
                  className="object-cover object-top-left"
                />
              </div>
            </div>
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
              disabled={loading || screenshotError !== null}
              className="flex-1 px-4 py-2 bg-ctp-text hover:bg-ctp-subtext1 text-ctp-base rounded-md border-2 border-ctp-subtext0 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
