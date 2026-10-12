"use client";

import { Loader2, TerminalSquare } from "lucide-react";
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
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(id: string) {
    setRevokingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/settings/cli-tokens/${id}`, {
        method: "DELETE",
      });

      // Already gone (revoked from the CLI meanwhile) is just as good.
      if (response.ok || response.status === 404) {
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
          {logins.map((login) => (
            <li
              key={login.id}
              className="flex items-center gap-4 bg-ctp-base rounded-lg border border-ctp-surface0 p-4"
            >
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
              <button
                type="button"
                onClick={() => revoke(login.id)}
                disabled={revokingId !== null}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-md border-2 border-ctp-red/50 text-ctp-red transition hover:bg-ctp-red/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {revokingId === login.id && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Revoke
              </button>
            </li>
          ))}
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
