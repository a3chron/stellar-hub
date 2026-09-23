"use client";

import { AtSign, Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { User as UserType } from "@/lib/db/types";
import {
  usernameError,
  usernameStateClass,
  useUsernameAvailability,
} from "@/lib/use-username-availability";

/**
 * The handle is the one profile field that is part of an address rather than a
 * decoration, so it gets its own section and its own endpoint - the rest of
 * the profile form saves through /api/settings/profile, which deliberately
 * cannot touch it.
 */
export default function UsernameSettings({
  user,
  hasPublishedThemes,
}: {
  user: UserType;
  hasPublishedThemes: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [username, setUsername] = useState(user.username);
  const [inputFocused, setInputFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isUnchanged = username === user.username;

  const availability = useUsernameAvailability(
    username,
    !hasPublishedThemes && !isUnchanged,
  );
  const problem = usernameError(availability);
  const inputStateClass =
    usernameStateClass(availability) ??
    "border-ctp-surface0 focus:border-ctp-overlay1 focus:ring-transparent";
  // An edited, usable handle that has been left without saving: nudge towards
  // the button so the change isn't lost by navigating away.
  const unsavedNudge =
    !isUnchanged &&
    !inputFocused &&
    !loading &&
    !saved &&
    availability.state === "available";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/settings/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (response.ok) {
        setSaved(true);
        router.refresh();
      } else {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Failed to change username");
      }
    } catch {
      setError("Failed to change username - are you offline?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8">
      <h2 className="text-2xl font-semibold text-ctp-text mb-2">Username</h2>
      <p className="text-sm text-ctp-subtext0 mb-6 leading-relaxed">
        Your themes are published at{" "}
        <span className="text-ctp-subtext1">
          stellar.a3chron.dev/{user.username}/&lt;theme&gt;
        </span>{" "}
        and applied with{" "}
        <span className="text-ctp-subtext1">
          stellar apply {user.username}/&lt;theme&gt;
        </span>
        .
      </p>

      {hasPublishedThemes ? (
        <div>
          <div className="flex items-center gap-3 px-4 py-3 bg-ctp-base border border-ctp-surface0 rounded text-ctp-subtext1">
            <AtSign className="w-4 h-4 text-ctp-overlay1 shrink-0" />
            {user.username}
          </div>
          <p className="text-sm text-ctp-subtext0 mt-2 leading-relaxed">
            Your username is locked because you've published a theme. Changing
            it now would break every saved link to your themes and every
            <code className="text-ctp-subtext1"> stellar apply </code>
            command people already have. Get in touch if you need it changed.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor={inputId}
              className="block text-sm font-medium text-ctp-text mb-2"
            >
              Username
            </label>
            <div className="relative">
              <input
                id={inputId}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setSaved(false);
                  setError(null);
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                maxLength={39}
                spellCheck={false}
                autoComplete="username"
                className={`w-full px-4 py-2 pr-10 bg-ctp-base border rounded text-ctp-text placeholder-ctp-overlay0 transition-colors focus:outline-none focus:ring-2 ${inputStateClass}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {availability.state === "checking" && (
                  <Loader2 className="w-4 h-4 animate-spin text-ctp-overlay0" />
                )}
                {availability.state === "available" && (
                  <Check className="w-4 h-4 text-ctp-green" />
                )}
                {problem && <X className="w-4 h-4 text-ctp-red" />}
              </span>
            </div>
            <p className="text-sm text-ctp-subtext0 mt-2 leading-relaxed">
              {problem ? (
                <span className="text-ctp-red">{problem}</span>
              ) : (
                <>
                  Letters, numbers, hyphens and underscores. You can change this
                  freely until you publish your first theme, after which it is
                  locked.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center justify-end gap-4">
            {error && (
              <p role="alert" className="text-sm text-ctp-red">
                {error}
              </p>
            )}
            {saved && !error && (
              <output className="text-sm text-ctp-green">Username saved</output>
            )}
            <button
              type="submit"
              disabled={loading || isUnchanged || problem !== null}
              className={`px-6 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-md border-2 transition disabled:opacity-50 ${
                unsavedNudge
                  ? "border-ctp-peach/70 ring-2 ring-ctp-peach/30"
                  : "border-ctp-surface1"
              }`}
            >
              {loading ? "Saving..." : "Change username"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
