"use client";

import { AlertTriangle } from "lucide-react";
import { useId, useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import type { User as UserType } from "@/lib/db/types";
import SettingsSection, { buttonClass } from "./settings-section";

/**
 * Account deletion. Kept behind a dialog and a typed confirmation because it
 * destroys published themes and breaks every link and `stellar apply`
 * command pointing at them - there is no undo.
 */
export default function DeleteAccount({
  user,
  themeCount,
}: {
  user: UserType;
  themeCount: number;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");

  const confirmed =
    confirmUsername.trim().toLowerCase() === user.username.toLowerCase();

  let themesDescription: React.ReactNode;
  if (themeCount === 0) {
    themesDescription = (
      <>
        Permanently deletes your profile, your sign-in methods, your drafts and
        your CLI logins.
      </>
    );
  } else if (themeCount === 1) {
    themesDescription = (
      <>
        Permanently deletes your profile, your sign-in methods, your drafts,
        your CLI logins and{" "}
        <span className="text-ctp-text">your 1 published theme</span> with every
        version. Anyone who has already downloaded it keeps their local copy,
        but the page and{" "}
        <code className="text-ctp-subtext1">stellar apply</code> command for it
        will stop working.
      </>
    );
  } else {
    themesDescription = (
      <>
        Permanently deletes your profile, your sign-in methods, your drafts,
        your CLI logins and{" "}
        <span className="text-ctp-text">
          all {themeCount} of your published themes
        </span>{" "}
        with every version. Anyone who has already downloaded a theme keeps
        their local copy, but the pages and{" "}
        <code className="text-ctp-subtext1">stellar apply</code> commands for
        them will stop working.
      </>
    );
  }

  // Resolves with the message to show in the dialog. On success the page
  // reloads, so the dialog simply stays busy until then.
  async function deleteAccount(): Promise<string | null> {
    try {
      const response = await fetch("/api/settings/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmUsername }),
      });

      if (response.ok) {
        // The session rows are gone, so the cookie now resolves to nothing.
        // A full page load is the cleanest way to drop all client state.
        window.location.href = "/";
        return null;
      }

      const data = await response.json().catch(() => null);
      return data?.error ?? "Failed to delete account";
    } catch {
      return "Failed to delete account - are you offline?";
    }
  }

  function close() {
    setOpen(false);
    setConfirmUsername("");
  }

  return (
    <SettingsSection id="danger-zone" title="Danger zone" tone="danger">
      <div className="flex flex-col gap-4 rounded-lg border border-ctp-surface0 bg-ctp-base p-3 sm:flex-row sm:items-center sm:gap-6 sm:p-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ctp-text">Delete account</h3>
          <p className="mt-1 text-sm leading-relaxed text-ctp-subtext0">
            {themesDescription} This can't be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${buttonClass("danger")} w-full sm:w-auto sm:shrink-0`}
        >
          Delete account
        </button>
      </div>

      {open && (
        <ConfirmDialog
          title="Delete your account?"
          confirmLabel="Delete my account"
          busyLabel="Deleting…"
          onConfirm={deleteAccount}
          onCancel={close}
          confirmDisabled={!confirmed}
        >
          <p>{themesDescription}</p>

          <div className="flex gap-3 rounded-lg border border-ctp-red/40 bg-ctp-red/10 p-4">
            <AlertTriangle className="w-5 h-5 shrink-0 text-ctp-red" />
            <p className="text-sm text-ctp-text leading-relaxed">
              This is permanent. Your username{" "}
              <span className="font-semibold">{user.username}</span> is released
              and could later be claimed by someone else.
            </p>
          </div>

          <div>
            <label
              htmlFor={inputId}
              className="block text-sm font-medium text-ctp-text mb-2"
            >
              Type <span className="font-semibold">{user.username}</span> to
              confirm
            </label>
            <input
              id={inputId}
              value={confirmUsername}
              onChange={(event) => setConfirmUsername(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full px-4 py-2 bg-ctp-mantle border border-ctp-surface0 rounded text-ctp-text placeholder-ctp-overlay0 focus:outline-none focus:border-ctp-red"
            />
          </div>
        </ConfirmDialog>
      )}
    </SettingsSection>
  );
}
