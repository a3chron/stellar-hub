"use client";

import { AtSign, Check, Loader2, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { User as UserType } from "@/lib/db/types";
import {
  usernameAnnouncement,
  usernameError,
  usernameStateClass,
  useUsernameAvailability,
} from "@/lib/use-username-availability";
import { cn } from "@/lib/utils";
import SettingsSection, { buttonClass } from "./settings-section";

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

  const description = (
    <>
      Your themes are published at{" "}
      <span className="break-words text-ctp-subtext1">
        stellar.a3chron.dev/{user.username}/&lt;theme&gt;
      </span>{" "}
      and applied with{" "}
      <code className="break-words text-ctp-subtext1">
        stellar apply {user.username}/&lt;theme&gt;
      </code>
      .
    </>
  );

  if (hasPublishedThemes) {
    return (
      <SettingsSection id="username" title="Username" description={description}>
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-ctp-text"
        >
          Username
        </label>
        <div className="relative max-w-md">
          <AtSign
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ctp-overlay1"
          />
          <input
            id={inputId}
            value={user.username}
            readOnly
            aria-describedby={`${inputId}-hint`}
            className="w-full cursor-default rounded-lg border-2 border-ctp-surface0 bg-ctp-crust/40 py-2 pr-10 pl-9 text-ctp-subtext1 focus:border-ctp-overlay1 focus:outline-none"
          />
          <Lock
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ctp-overlay1"
          />
        </div>
        <p
          id={`${inputId}-hint`}
          className="mt-2 text-sm leading-relaxed text-ctp-subtext0"
        >
          Locked because you've published a theme. Changing it now would break
          every saved link to your themes and every{" "}
          <code className="text-ctp-subtext1">stellar apply</code> command
          people already have. Get in touch if you need it changed.
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection id="username" title="Username" description={description}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="max-w-md">
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-ctp-text"
          >
            Username
          </label>
          <div className="relative">
            <AtSign
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ctp-overlay1"
            />
            <input
              id={inputId}
              aria-invalid={problem !== null}
              aria-describedby={`${inputId}-hint`}
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
              className={`w-full rounded-lg border-2 bg-ctp-base py-2 pr-10 pl-9 text-ctp-text placeholder-ctp-overlay0 transition-colors focus:outline-none focus:ring-2 ${inputStateClass}`}
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2">
              {availability.state === "checking" && (
                <Loader2 className="size-4 animate-spin text-ctp-overlay0" />
              )}
              {availability.state === "available" && (
                <Check className="size-4 text-ctp-green" />
              )}
              {problem && <X className="size-4 text-ctp-red" />}
            </span>
            <span className="sr-only" aria-live="polite">
              {usernameAnnouncement(availability)}
            </span>
          </div>
        </div>
        <p
          id={`${inputId}-hint`}
          className="text-sm leading-relaxed text-ctp-subtext0"
        >
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

        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-ctp-surface0 pt-4">
          {error && (
            <p role="alert" className="text-sm text-ctp-red">
              {error}
            </p>
          )}
          {saved && !error && (
            // Green text is too faint on Latte; the icon carries the colour.
            <output className="flex items-center gap-1.5 text-sm text-ctp-text">
              <Check aria-hidden="true" className="size-4 text-ctp-green" />
              Username saved
            </output>
          )}
          <button
            type="submit"
            disabled={loading || isUnchanged || problem !== null}
            className={cn(
              buttonClass("primary"),
              unsavedNudge &&
                "ring-2 ring-ctp-peach/60 ring-offset-2 ring-offset-ctp-mantle",
            )}
          >
            {loading && (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            )}
            {loading ? "Saving…" : "Change username"}
          </button>
        </div>
      </form>
    </SettingsSection>
  );
}
