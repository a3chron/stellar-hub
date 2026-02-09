"use client";

import { Download, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Theme {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  screenshotUrl: string;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ThemeManagementProps {
  themes: Theme[];
}

export default function ThemeManagement({ themes }: ThemeManagementProps) {
  const router = useRouter();
  const [editingTheme, setEditingTheme] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleEdit = (themeId: string) => {
    setEditingTheme(themeId);
  };

  const handleDelete = async (themeId: string) => {
    if (deleteConfirm !== themeId) {
      setDeleteConfirm(themeId);
      return;
    }

    const response = await fetch(`/api/settings/themes/${themeId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      router.refresh();
      setDeleteConfirm(null);
    }
  };

  if (themes.length === 0) {
    return (
      <section className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8">
        <h2 className="text-2xl font-semibold text-ctp-text mb-6">
          Your Themes
        </h2>
        <div className="text-center py-12">
          <p className="text-ctp-subtext0 mb-4">
            You haven't uploaded any themes yet
          </p>
          <a
            href="/upload"
            className="inline-block px-6 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded border border-ctp-surface1 transition"
          >
            Upload Your First Theme
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8">
      <h2 className="text-2xl font-semibold text-ctp-text mb-6">
        Your Themes ({themes.length})
      </h2>

      <div className="space-y-4">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className="bg-ctp-base rounded-lg border border-ctp-surface0 p-4 hover:border-ctp-surface1 transition"
          >
            <div className="flex items-start gap-4">
              {/* Screenshot */}
              <div className="relative w-32 h-20 rounded overflow-hidden shrink-0 bg-ctp-surface0">
                <Image
                  src={theme.screenshotUrl}
                  alt={theme.name}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-ctp-text">
                      {theme.name}
                    </h3>
                    <p className="text-sm text-ctp-subtext0 font-mono">
                      {theme.slug}
                    </p>
                    {theme.description && (
                      <p className="text-sm text-ctp-subtext0 mt-1 line-clamp-2">
                        {theme.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(theme.id)}
                      type="button"
                      className="p-2 hover:bg-ctp-surface0 rounded text-ctp-subtext0 hover:text-ctp-text transition"
                      title="Edit theme"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(theme.id)}
                      type={deleteConfirm ? "submit" : "button"}
                      className={`p-2 hover:bg-ctp-surface0 rounded transition ${
                        deleteConfirm === theme.id
                          ? "text-ctp-red"
                          : "text-ctp-subtext0 hover:text-ctp-red"
                      }`}
                      title={
                        deleteConfirm === theme.id
                          ? "Click again to confirm"
                          : "Delete theme"
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-3 text-sm text-ctp-subtext0">
                  <div className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    <span>{theme.downloads} downloads</span>
                  </div>
                  <span>•</span>
                  <span>
                    Updated {new Date(theme.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Delete confirmation */}
                {deleteConfirm === theme.id && (
                  <div className="mt-3 p-3 bg-ctp-surface0 border border-ctp-red/20 rounded">
                    <p className="text-sm text-ctp-red">
                      Are you sure? Click delete again to confirm. This cannot
                      be undone.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
