"use client";

import { Github, Globe, Upload, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User as UserType } from "@/lib/db/types";

export default function ProfileSettings({ user }: { user: UserType }) {
  const router = useRouter();
  const [bio, setBio] = useState(user.bio || "");
  const [socialLinks, setSocialLinks] = useState({
    github: user.socialLinks?.github || "",
    website: user.socialLinks?.website || "",
  });
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(user.image);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("bio", bio);
    formData.append("socialLinks", JSON.stringify(socialLinks));
    if (imageFile) {
      formData.append("avatar", imageFile);
    }

    const response = await fetch("/api/settings/profile", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      router.refresh();
    }

    setLoading(false);
  };

  return (
    <section className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8">
      <h2 className="text-2xl font-semibold text-ctp-text mb-6">Profile</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar */}
        <div>
          <span className="block text-sm font-medium text-ctp-text mb-3">
            Avatar
          </span>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-ctp-surface0 border-2 border-ctp-surface1">
              {previewImage ? (
                <Image
                  src={previewImage}
                  alt={user.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-ctp-overlay0" />
                </div>
              )}
            </div>

            <label className="cursor-pointer px-4 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-md border-2 border-ctp-surface1 transition flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-sm text-ctp-subtext0 mt-2">
            {user.image?.includes("github") &&
              "Currently using GitHub profile picture"}
          </p>
        </div>

        {/* Bio */}
        <div>
          <label
            htmlFor="bio"
            className="block text-sm font-medium text-ctp-text mb-2"
          >
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Tell us about yourself..."
            className="w-full px-4 py-3 bg-ctp-base border border-ctp-surface0 rounded text-ctp-text placeholder-ctp-overlay0 focus:outline-none focus:border-ctp-overlay1"
          />
          <p className="text-sm text-ctp-subtext0 mt-1">
            {bio.length}/500 characters
          </p>
        </div>

        {/* Social Links */}
        <div className="space-y-4">
          <span className="block text-sm font-medium text-ctp-text">
            Social Links
          </span>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Github className="w-5 h-5 text-ctp-overlay1 shrink-0" />
              <input
                value={socialLinks.github}
                onChange={(e) =>
                  setSocialLinks({ ...socialLinks, github: e.target.value })
                }
                placeholder="username"
                className="flex-1 px-4 py-2 bg-ctp-base border border-ctp-surface0 rounded text-ctp-text placeholder-ctp-overlay0 focus:outline-none focus:border-ctp-overlay1"
              />
            </div>

            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-ctp-overlay1 shrink-0" />
              <input
                type="url"
                value={socialLinks.website}
                onChange={(e) =>
                  setSocialLinks({ ...socialLinks, website: e.target.value })
                }
                placeholder="https://yourwebsite.com"
                className="flex-1 px-4 py-2 bg-ctp-base border border-ctp-surface0 rounded text-ctp-text placeholder-ctp-overlay0 focus:outline-none focus:border-ctp-overlay1"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-md border-2 border-ctp-surface1 transition disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
