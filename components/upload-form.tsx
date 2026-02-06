"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const { slug, author } = await response.json();
      router.push(`/themes/${author}/${slug}`);
    } else {
      alert("Upload failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Theme Name</label>
        <input
          type="text"
          name="name"
          required
          className="w-full border rounded px-3 py-2"
          placeholder="My Awesome Theme"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          name="description"
          rows={3}
          className="w-full border rounded px-3 py-2"
          placeholder="A brief description..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Min starship version
        </label>
        <input
          type="text"
          name="minStarshipVersion"
          defaultValue="1.0.0"
          pattern="^\d+\.\d+\.\d+$"
          placeholder="1.24.2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Screenshot</label>
        <input
          type="file"
          name="screenshot"
          accept="image/png,image/jpeg,image/webp"
          required
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Starship Config (TOML)
        </label>
        <textarea
          name="config"
          rows={10}
          required
          className="w-full border rounded px-3 py-2 font-mono text-sm"
          placeholder="[character]
success_symbol = '[➜](bold green)'
..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Version</label>
        <input
          type="text"
          name="version"
          required
          defaultValue="1.0"
          pattern="^v?\d+\.\d+$"
          className="w-full border rounded px-3 py-2"
          placeholder="1.0"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Uploading..." : "Upload Theme"}
      </button>
    </form>
  );
}
