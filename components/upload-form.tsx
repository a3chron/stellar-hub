"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Input from "./input";

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
        <Input
          type="text"
          name="name"
          label="Theme Name"
          required
          placeholder="My Awesome Theme"
        />
      </div>

      <div>
        <label className="flex flex-col">
          <span className="mb-1.5 text-sm">Description</span>
          <textarea
            name="description"
            rows={3}
            className="p-2 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-text placeholder:text-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
            placeholder="A brief description..."
          />
        </label>
      </div>

      {/** TODO: get latest starship verison & prefill */}
      <div>
        <Input
          type="text"
          name="minStarshipVersion"
          label="Min starship version"
          defaultValue="1.24.0"
          pattern="^\d+\.\d+\.\d+$"
          placeholder="1.24.0"
        />
      </div>

      <div>
        <label className="flex flex-col text-sm mb-2">
          Screenshot
          <input
            type="file"
            name="screenshot"
            accept="image/png,image/jpeg,image/webp"
            required
            className="w-fit bg-ctp-mantle border-2 border-ctp-crust p-2 px-4 rounded-lg mt-1.5 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
          />
        </label>
      </div>

      <div>
        <label className="flex flex-col">
          <span className="mb-1.5 text-sm">Starship Config (TOML)</span>
          <textarea
            name="config"
            rows={10}
            required
            className="p-2 rounded-lg text-sm bg-ctp-mantle border-2 border-ctp-crust text-text placeholder:text-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
            placeholder="[character]
success_symbol = '[➜](bold green)'
..."
          />
        </label>
      </div>

      <div>
        <Input
          type="text"
          name="version"
          label="Version"
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
        className="w-full bg-ctp-text border-2 border-ctp-subtext0 text-ctp-crust py-3 rounded-lg font-semibold disabled:bg-ctp-mantle"
      >
        {loading ? "Uploading..." : "Upload Theme"}
      </button>
    </form>
  );
}
