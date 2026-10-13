"use client";

import { TerminalSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { LocalDate, TimeAgo } from "@/components/local-time";
import type { CliToken } from "@/lib/db/types";
import { useFocusAfterRemoval } from "./use-focus-after-removal";

type CliLogin = Pick<CliToken, "id" | "label" | "createdAt" | "lastUsedAt">;

/**
 * Every terminal that ran `stellar auth` and was approved. Tokens never
 * expire on their own, and uninstalling stellar can't always revoke its own
 * login (offline, or the files were simply deleted), so this list is the
 * place to clean up.
 */
export default function CliSessions({ logins }: { logins: CliLogin[] }) {
  const router = useRouter();
  const [revoking, setRevoking] = useState<CliLogin | null>(null);
  const { headingRef, buttonRef, removing } = useFocusAfterRemoval(
    logins.map((login) => login.id),
  );

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
    <section
      id="cli-logins"
      className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8 scroll-mt-24"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold text-ctp-text mb-2 focus:outline-none"
      >
        CLI logins
      </h2>
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
                ref={buttonRef(login.id)}
                onClick={() => setRevoking(login)}
                className="shrink-0 px-4 py-2 text-sm rounded-md border-2 border-ctp-red/50 text-ctp-red transition hover:bg-ctp-red/10 cursor-pointer"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      {revoking && (
        <ConfirmDialog
          title="Revoke CLI login?"
          confirmLabel="Revoke"
          busyLabel="Revoking..."
          onConfirm={() => revoke(revoking)}
          onCancel={() => setRevoking(null)}
        >
          <p>
            <span className="font-mono text-ctp-text">{revoking.label}</span>,
            logged in <LocalDate date={revoking.createdAt} />, is logged out
            right away. That terminal needs{" "}
            <code className="text-ctp-subtext1">stellar auth</code> again before
            it can publish anything.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
