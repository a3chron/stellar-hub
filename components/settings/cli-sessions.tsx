"use client";

import { Loader2, TerminalSquare, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalDate, TimeAgo } from "@/components/local-time";
import type { CliToken } from "@/lib/db/types";

type CliLogin = Pick<CliToken, "id" | "label" | "createdAt" | "lastUsedAt">;

/**
 * Every terminal that ran `stellar auth` and was approved. Tokens never
 * expire on their own, and uninstalling stellar can't always revoke its own
 * login (offline, or the files were simply deleted), so this list is the
 * place to clean up.
 */
export default function CliSessions({ logins }: { logins: CliLogin[] }) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Two clicks, like deleting a theme or a draft: the first one only asks.
  async function revoke(id: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      setError(null);
      return;
    }

    setRevokingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/settings/cli-tokens/${id}`, {
        method: "DELETE",
      });

      // Already gone (revoked from the CLI meanwhile) is just as good.
      if (response.ok || response.status === 404) {
        setConfirmId(null);
        router.refresh();
        return;
      }

      const body = await response.json().catch(() => null);
      setError(body?.error ?? `Revoking failed (${response.status})`);
    } catch {
      setError(
        "Could not reach the server - check your connection and try again.",
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section
      id="cli-logins"
      className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8 scroll-mt-24"
    >
      <h2 className="text-2xl font-semibold text-ctp-text mb-2">CLI logins</h2>
      <p className="text-sm text-ctp-subtext0 mb-6 leading-relaxed">
        Terminals where you ran{" "}
        <code className="text-ctp-subtext1">stellar auth</code>. They can create
        and publish theme drafts as you until you revoke them. See{" "}
        <Link href="/docs/publishing" className="underline">
          publishing from the CLI
        </Link>
        .
      </p>

      {logins.length === 0 ? (
        <p className="text-sm text-ctp-subtext0">No CLI logins yet.</p>
      ) : (
        <ul className="space-y-3">
          {logins.map((login) => {
            const confirming = confirmId === login.id;
            const revoking = revokingId === login.id;

            let revokeLabel = "Revoke";
            if (revoking) {
              revokeLabel = "Revoking...";
            } else if (confirming) {
              revokeLabel = "Confirm revoke";
            }

            return (
              <li
                key={login.id}
                className="bg-ctp-base rounded-lg border border-ctp-surface0 p-4"
              >
                <div className="flex items-center gap-4">
                  <TerminalSquare className="w-5 h-5 shrink-0 text-ctp-overlay1" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-ctp-text truncate">
                      {login.label}
                    </p>
                    <p className="text-xs text-ctp-subtext0 mt-1">
                      Logged in <LocalDate date={login.createdAt} /> · last used{" "}
                      {login.lastUsedAt ? (
                        <TimeAgo date={login.lastUsedAt} />
                      ) : (
                        "never"
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => revoke(login.id)}
                      disabled={revokingId !== null}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md border-2 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                        confirming
                          ? "border-ctp-red bg-ctp-red text-ctp-crust"
                          : "border-ctp-red/50 text-ctp-red hover:bg-ctp-red/10"
                      }`}
                    >
                      {revoking && <Loader2 className="w-4 h-4 animate-spin" />}
                      {revokeLabel}
                    </button>
                    {confirming && (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmId(null);
                          setError(null);
                        }}
                        disabled={revoking}
                        className="p-2 rounded-md bg-ctp-surface0 text-ctp-text cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        title="Cancel"
                        aria-label="Cancel revoking"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {confirming && (
                  <p className="text-sm text-ctp-subtext0 mt-3">
                    Are you sure? That terminal can't publish anymore until you
                    run <code className="text-ctp-subtext1">stellar auth</code>{" "}
                    there again.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-ctp-red mt-4">
          {error}
        </p>
      )}
    </section>
  );
}
