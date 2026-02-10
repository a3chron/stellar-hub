"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Input from "./input";

interface Theme {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  screenshotUrl: string;
  colorSchemeId: string | null;
  group: string | null;
}

interface EditMetadataFormProps {
  theme: Theme;
  colorSchemes: Array<{ id: string; name: string }>;
  onCancel: () => void;
}

export default function EditMetadataForm({
  theme,
  colorSchemes,
  onCancel,
}: EditMetadataFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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

    const formData = new FormData(e.currentTarget);

    const response = await fetch(`/api/themes/${theme.id}/metadata`, {
      method: "PATCH",
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
        <h3 className="text-2xl font-semibold text-ctp-text mb-6">
          Edit Metadata: {theme.name}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Color Scheme */}
          <div>
            <label className="flex flex-col">
              <span className="mb-1.5 text-sm text-ctp-text">Color Scheme</span>
              <select
                name="colorSchemeId"
                defaultValue={theme.colorSchemeId || ""}
                className="p-2 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-surface0"
              >
                <option value="">None</option>
                {colorSchemes.map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {scheme.name}
                  </option>
                ))}
              </select>
            </label>
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
              <div className="relative w-full h-48 rounded overflow-hidden bg-ctp-surface0">
                <Image
                  src={previewImage || theme.screenshotUrl}
                  alt={theme.name}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
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
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
