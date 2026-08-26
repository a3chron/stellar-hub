"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning";
import Input from "./input";
import Select from "./select";

type ColorMode = "dark" | "light" | "both";

interface Theme {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  screenshotUrl: string;
  colorSchemeId: string | null;
  colorMode: ColorMode;
  group: string | null;
}

interface EditMetadataFormProps {
  author: string;
  theme: Theme;
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
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useUnsavedChangesWarning(dirty);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-ctp-base rounded-lg border border-ctp-surface0 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-semibold text-ctp-text mb-6">
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
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                className="w-fit bg-ctp-mantle border-2 border-ctp-crust p-2 px-4 rounded-lg mt-1.5 text-ctp-text file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-ctp-surface0 file:text-ctp-text"
              />
            </label>

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
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
