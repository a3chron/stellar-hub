"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      router.push(`/${author}/${slug}`);
    } else {
      alert("Upload failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          Theme Name
          <input
            type="text"
            name="name"
            required
            className="w-full border rounded px-3 py-2"
            placeholder="My Awesome Theme"
          />
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Description
          <textarea
            name="description"
            rows={3}
            className="w-full border rounded px-3 py-2"
            placeholder="A brief description..."
          />
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Min starship version
          <input
            type="text"
            name="minStarshipVersion"
            defaultValue="1.0.0"
            pattern="^\d+\.\d+\.\d+$"
            placeholder="1.24.2"
          />
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Screenshot
          <input
            type="file"
            name="screenshot"
            accept="image/png,image/jpeg,image/webp"
            required
            className="w-full"
          />
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Starship Config (TOML)
          <textarea
            name="config"
            rows={10}
            required
            className="w-full border rounded px-3 py-2 font-mono text-sm"
            placeholder="[character]
success_symbol = '[➜](bold green)'
..."
          />
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Version
          <input
            type="text"
            name="version"
            required
            defaultValue="1.0"
            pattern="^v?\d+\.\d+$"
            className="w-full border rounded px-3 py-2"
            placeholder="1.0"
          />
        </label>
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
