"use client";

import { Loader2, Pencil, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { LocalDate, TimeAgo } from "@/components/local-time";
import {
  CLI_LOGIN_NAME_MAX_LENGTH,
  checkLoginName,
  displayLoginName,
} from "@/lib/cli-login-name";
import type { CliToken } from "@/lib/db/types";
import SettingsSection, { buttonClass } from "./settings-section";
import { useFocusAfterRemoval } from "./use-focus-after-removal";

type CliLogin = Pick<CliToken, "id" | "label" | "createdAt" | "lastUsedAt">;

/**
 * Every terminal that ran `stellar auth` and was approved, under the name
 * chosen when approving it (renameable here). Tokens never expire on their
 * own, and uninstalling stellar can't always revoke its own login (offline,
 * or the files were simply deleted), so this list is the place to clean up.
 */
export default function CliSessions({ logins }: { logins: CliLogin[] }) {
  const router = useRouter();
  const nameInputId = useId();
  const [revoking, setRevoking] = useState<CliLogin | null>(null);
  const { headingRef, buttonRef, removing } = useFocusAfterRemoval(
    logins.map((login) => login.id),
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const pencilButtons = useRef(new Map<string, HTMLButtonElement>());
  // The pencil to hand focus back to once editing ends.
  const [returnFocusTo, setReturnFocusTo] = useState<string | null>(null);

  useEffect(() => {
    if (editingId) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (returnFocusTo && !editingId) {
      pencilButtons.current.get(returnFocusTo)?.focus();
      setReturnFocusTo(null);
    }
  }, [returnFocusTo, editingId]);

  function startRename(login: CliLogin) {
    setEditingId(login.id);
    setEditName(displayLoginName(login.label));
    setRenameError(null);
  }

  function stopRename(id: string) {
    setEditingId(null);
    setRenameError(null);
    setReturnFocusTo(id);
  }

  async function saveRename(login: CliLogin) {
    const check = checkLoginName(editName);
    if (!check.ok) {
      setRenameError(`The name ${check.error}.`);
      return;
    }

    setSavingName(true);
    setRenameError(null);
    try {
      const response = await fetch(`/api/settings/cli-tokens/${login.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: check.name }),
      });
      if (response.ok) {
        stopRename(login.id);
        router.refresh();
        return;
      }
      const body = await response.json().catch(() => null);
      setRenameError(body?.error ?? `Renaming failed (${response.status})`);
    } catch {
      setRenameError(
        "Could not reach the server - check your connection and try again.",
      );
    } finally {
      setSavingName(false);
    }
  }

  // Resolves with the message to show in the dialog, or null once revoked.
  async function revoke(login: CliLogin): Promise<string | null> {
    try {
      const response = await fetch(`/api/settings/cli-tokens/${login.id}`, {
        method: "DELETE",
      });

      // Already gone (revoked from the CLI meanwhile) is just as good.
      if (response.ok || response.status === 404) {
        removing(login.id);
        setRevoking(null);
        router.refresh();
        return null;
      }

      const body = await response.json().catch(() => null);
      return body?.error ?? `Revoking failed (${response.status})`;
    } catch {
      return "Could not reach the server - check your connection and try again.";
    }
  }

  return (
    <SettingsSection
      id="cli-logins"
      title="CLI logins"
      count={logins.length}
      headingRef={headingRef}
      description={
        <>
          Terminals where you ran{" "}
          <code className="text-ctp-subtext1">stellar auth</code>. They can
          create and publish theme drafts as you until you revoke them. See{" "}
          <Link
            href="/docs/publishing"
            className="text-ctp-lavender underline underline-offset-2"
          >
            publishing from the CLI
          </Link>
          .
        </>
      }
    >
      {logins.length === 0 ? (
        <p className="text-sm text-ctp-subtext0">No CLI logins yet.</p>
      ) : (
        <ul className="space-y-3">
          {logins.map((login) => {
            const name = displayLoginName(login.label);
            const editing = editingId === login.id;

            return (
              <li
                key={login.id}
                className="flex flex-col gap-3 rounded-lg border border-ctp-surface0 bg-ctp-base p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                  <TerminalSquare
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-ctp-overlay1 sm:mt-0"
                  />
                  <div className="flex-1 min-w-0">
                    {editing ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveRename(login);
                        }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <label htmlFor={nameInputId} className="sr-only">
                          Name of this login
                        </label>
                        <input
                          ref={nameInputRef}
                          id={nameInputId}
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              stopRename(login.id);
                            }
                          }}
                          maxLength={CLI_LOGIN_NAME_MAX_LENGTH}
                          autoComplete="off"
                          spellCheck={false}
                          aria-invalid={renameError !== null}
                          aria-describedby={
                            renameError ? `${nameInputId}-error` : undefined
                          }
                          className="min-w-0 flex-1 basis-40 rounded-lg border-2 border-ctp-surface0 bg-ctp-mantle px-2 py-1 text-sm text-ctp-text focus:border-ctp-overlay1 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={savingName}
                          className={buttonClass("primary", "xs")}
                        >
                          {savingName && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => stopRename(login.id)}
                          disabled={savingName}
                          className={buttonClass("secondary", "xs")}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-medium text-ctp-text truncate">
                          {name}
                        </p>
                        <button
                          type="button"
                          ref={(element) => {
                            if (element) {
                              pencilButtons.current.set(login.id, element);
                            } else {
                              pencilButtons.current.delete(login.id);
                            }
                          }}
                          onClick={() => startRename(login)}
                          aria-label={`Rename ${name}`}
                          title="Rename"
                          className="shrink-0 p-1 rounded text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0 transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {editing && renameError && (
                      <p
                        id={`${nameInputId}-error`}
                        role="alert"
                        className="text-xs text-ctp-red mt-1"
                      >
                        {renameError}
                      </p>
                    )}
                    <p className="text-xs text-ctp-subtext0 mt-1">
                      Logged in <LocalDate date={login.createdAt} /> · last used{" "}
                      {login.lastUsedAt ? (
                        <TimeAgo date={login.lastUsedAt} />
                      ) : (
                        "never"
                      )}
                    </p>
                  </div>
                </div>
                {/* Below the name on a phone, so the name keeps the width. */}
                <button
                  type="button"
                  ref={buttonRef(login.id)}
                  onClick={() => setRevoking(login)}
                  aria-label={`Revoke ${name}`}
                  className={`${buttonClass("danger")} w-full sm:w-auto sm:shrink-0`}
                >
                  Revoke
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {revoking && (
        <ConfirmDialog
          title="Revoke CLI login?"
          confirmLabel="Revoke"
          busyLabel="Revoking…"
          onConfirm={() => revoke(revoking)}
          onCancel={() => setRevoking(null)}
        >
          <p>
            <span className="font-medium text-ctp-text">
              {displayLoginName(revoking.label)}
            </span>
            , logged in <LocalDate date={revoking.createdAt} />, is logged out
            right away. That terminal needs{" "}
            <code className="text-ctp-subtext1">stellar auth</code> again before
            it can publish anything.
          </p>
        </ConfirmDialog>
      )}
    </SettingsSection>
  );
}
