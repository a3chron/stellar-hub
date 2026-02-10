"use client";

import { Download, Pencil, Trash2, Upload, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import EditMetadataForm from "../edit-metadata-form";
import UpdateConfigForm from "../update-config-form";

interface Theme {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  screenshotUrl: string;
  downloads: number;
  colorSchemeId: string | null;
  group: string | null;
  createdAt: Date;
  updatedAt: Date;
  versions: Array<{
    version: string;
    dependencies: string[] | null;
    minStarshipVersion: string;
  }>;
}

interface ThemeManagementProps {
  author: string;
  themes: Theme[];
  colorSchemes: Array<{ id: string; name: string }>;
}

export default function ThemeManagement({
  author,
  themes,
  colorSchemes,
}: ThemeManagementProps) {
  const router = useRouter();
  const [editingMetadata, setEditingMetadata] = useState<string | null>(null);
  const [updatingConfig, setUpdatingConfig] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const editingTheme = themes.find((t) => t.id === editingMetadata);
  const updatingTheme = themes.find((t) => t.id === updatingConfig);

  return (
    <>
      <section className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8">
        <h2 className="text-2xl font-semibold text-ctp-text mb-6">
          Your Themes ({themes.length})
        </h2>

        <div className="space-y-4">
          {themes.map((theme) => {
            const latestVersion = theme.versions[0];

            return (
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
                      className="object-cover object-top-left"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          href={`/${author}/${theme.slug}`}
                          className="text-lg font-semibold text-ctp-text hover:underline"
                        >
                          {theme.name}
                        </Link>
                        <p className="text-sm text-ctp-subtext0 font-mono">
                          {theme.slug} • v{latestVersion?.version || "1.0"}
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
                          onClick={() => setEditingMetadata(theme.id)}
                          type="button"
                          className="p-2 hover:bg-ctp-surface0 rounded text-ctp-subtext0 hover:text-ctp-text transition cursor-pointer"
                          title="Edit metadata"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setUpdatingConfig(theme.id)}
                          type="button"
                          className="p-2 hover:bg-ctp-surface0 rounded text-ctp-subtext0 hover:text-ctp-text transition cursor-pointer"
                          title="Update config"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(theme.id)}
                          type={deleteConfirm ? "submit" : "button"}
                          className={`p-2 transition cursor-pointer ${
                            deleteConfirm === theme.id
                              ? "text-ctp-crust bg-ctp-red rounded-l pr-2.5"
                              : "text-ctp-subtext0 hover:text-ctp-red hover:bg-ctp-surface0 rounded"
                          }`}
                          title={
                            deleteConfirm === theme.id
                              ? "Click again to confirm"
                              : "Delete theme"
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {deleteConfirm === theme.id && (
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            type="button"
                            className="p-2 pl-2.5 -ml-2 bg-ctp-surface0 rounded-r text-ctp-text cursor-pointer"
                            title="Update config"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 text-sm text-ctp-subtext0">
                      <div className="flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        <span>{theme.downloads} downloads</span>
                      </div>
                      <span>•</span>
                      <span>{theme.versions.length} versions</span>
                      <span>•</span>
                      <span>
                        Updated {new Date(theme.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Delete confirmation */}
                    {deleteConfirm === theme.id && (
                      <div className="mt-3 p-3 bg-ctp-surface0 border border-ctp-red/20 rounded">
                        <p className="text-sm text-ctp-red">
                          Are you sure? Click delete again to confirm. This
                          cannot be undone.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Edit Metadata Modal */}
      {editingTheme && (
        <EditMetadataForm
          theme={editingTheme}
          colorSchemes={colorSchemes}
          onCancel={() => setEditingMetadata(null)}
        />
      )}

      {/* Update Config Modal */}
      {updatingTheme?.versions[0] && (
        <UpdateConfigForm
          themeId={updatingTheme.id}
          themeName={updatingTheme.name}
          latestVersion={updatingTheme.versions[0]}
          onCancel={() => setUpdatingConfig(null)}
        />
      )}
    </>
  );
}
