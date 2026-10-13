"use client";

import { Check, Github, Globe, Loader2, Upload, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { User as UserType } from "@/lib/db/types";
import SettingsSection, { buttonClass, FIELD } from "./settings-section";

// What /api/settings/profile accepts for an avatar - checked here as well so
// a too-large file is refused on selection, not after the upload.
const AVATAR_TYPES = "image/png,image/jpeg,image/webp";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export default function ProfileSettings({ user }: { user: UserType }) {
  const router = useRouter();
  const fieldId = useId();
  const [bio, setBio] = useState(user.bio || "");
  const [socialLinks, setSocialLinks] = useState({
    github: user.socialLinks?.github || "",
    website: user.socialLinks?.website || "",
  });
  // What is stored, to tell whether anything changed. Moved forward on a
  // successful save rather than taken from `user`, which only catches up
  // once the refresh after it has finished.
  const [savedValues, setSavedValues] = useState({
    bio: user.bio || "",
    github: user.socialLinks?.github || "",
    website: user.socialLinks?.website || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(user.image);

  const dirty =
    imageFile !== null ||
    bio !== savedValues.bio ||
    socialLinks.github !== savedValues.github ||
    socialLinks.website !== savedValues.website;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("That image is larger than 5 MB - pick a smaller one.");
      e.target.value = "";
      return;
    }
    setAvatarError(null);
    setSaved(false);
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const formData = new FormData();
    formData.append("bio", bio);
    formData.append("socialLinks", JSON.stringify(socialLinks));
    if (imageFile) {
      formData.append("avatar", imageFile);
    }

    try {
      const response = await fetch("/api/settings/profile", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setSaved(true);
        setSavedValues({ bio, ...socialLinks });
        setImageFile(null);
        router.refresh();
      } else {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Failed to save changes");
      }
    } catch {
      setError("Failed to save changes - are you offline?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsSection
      id="profile"
      title="Profile"
      description="Shown on your public profile page and next to your themes."
    >
      <form
        onSubmit={handleSubmit}
        className="grid gap-6 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8"
      >
        {/* Avatar */}
        <div className="flex items-center gap-4 md:flex-col md:items-start">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-ctp-surface1 bg-ctp-surface0 md:size-28">
            {previewImage ? (
              <Image
                src={previewImage}
                alt={user.name}
                fill
                sizes="112px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className="size-1/2 text-ctp-overlay0" />
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            {/* The input is visually hidden but stays focusable, so the
                label works as the button for keyboard users too. */}
            <label
              className={`${buttonClass("secondary", "sm")} focus-within:ring-2 focus-within:ring-ctp-overlay1`}
            >
              <Upload aria-hidden="true" className="size-4" />
              Upload image
              <input
                type="file"
                accept={AVATAR_TYPES}
                onChange={handleImageChange}
                aria-describedby={`${fieldId}-avatar-hint`}
                className="sr-only"
              />
            </label>
            <p
              id={`${fieldId}-avatar-hint`}
              className="text-xs leading-relaxed text-ctp-subtext0"
            >
              PNG, JPEG or WebP, up to 5 MB.
              {user.image?.includes("github") && !imageFile && (
                <> Currently using your GitHub profile picture.</>
              )}
            </p>
            {avatarError && (
              <p role="alert" className="text-xs text-ctp-red">
                {avatarError}
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          {/* Bio */}
          <div>
            <label
              htmlFor={`${fieldId}-bio`}
              className="mb-1.5 block text-sm font-medium text-ctp-text"
            >
              Bio
            </label>
            <textarea
              id={`${fieldId}-bio`}
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                setSaved(false);
              }}
              rows={4}
              maxLength={500}
              placeholder="Tell us about yourself…"
              aria-describedby={`${fieldId}-bio-count`}
              className={`${FIELD} resize-y px-3`}
            />
            <p
              id={`${fieldId}-bio-count`}
              className="mt-1 text-xs text-ctp-subtext0 tabular-nums"
            >
              {bio.length}/500 characters
            </p>
          </div>

          {/* Social Links */}
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor={`${fieldId}-github`}
                className="mb-1.5 block text-sm font-medium text-ctp-text"
              >
                GitHub username
              </label>
              <div className="relative">
                <Github
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ctp-overlay1"
                />
                <input
                  id={`${fieldId}-github`}
                  value={socialLinks.github}
                  onChange={(e) => {
                    setSocialLinks({ ...socialLinks, github: e.target.value });
                    setSaved(false);
                  }}
                  placeholder="username"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${FIELD} pr-3 pl-9`}
                />
              </div>
            </div>

            <div className="min-w-0">
              <label
                htmlFor={`${fieldId}-website`}
                className="mb-1.5 block text-sm font-medium text-ctp-text"
              >
                Website
              </label>
              <div className="relative">
                <Globe
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ctp-overlay1"
                />
                <input
                  id={`${fieldId}-website`}
                  type="url"
                  value={socialLinks.website}
                  onChange={(e) => {
                    setSocialLinks({ ...socialLinks, website: e.target.value });
                    setSaved(false);
                  }}
                  placeholder="https://yourwebsite.com"
                  autoComplete="url"
                  className={`${FIELD} pr-3 pl-9`}
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-ctp-surface0 pt-4">
            {error && (
              <p role="alert" className="text-sm text-ctp-red">
                {error}
              </p>
            )}
            {saved && !error && !dirty && (
              // Green text is too faint on Latte; the icon carries the colour.
              <output className="flex items-center gap-1.5 text-sm text-ctp-text">
                <Check aria-hidden="true" className="size-4 text-ctp-green" />
                Changes saved
              </output>
            )}
            {dirty && !error && !loading && (
              <p className="flex items-center gap-2 text-sm text-ctp-subtext0">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-ctp-peach"
                />
                Unsaved changes
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !dirty}
              className={buttonClass("primary")}
            >
              {loading && (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              )}
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </SettingsSection>
  );
}
