import { eq } from "drizzle-orm";
import { CircleX, Clock, TerminalSquare } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import { auth } from "@/lib/auth";
import { formatUserCode, normalizeUserCode } from "@/lib/cli-auth";
import { db } from "@/lib/db";
import { cliAuthRequests, user } from "@/lib/db/schema";
import { getClientIPFromHeaders } from "@/lib/rate-limit";
import { formatTimeAgo } from "@/lib/utils";
import AuthorizeForm, { DecisionResult } from "./authorize-form";

export const metadata: Metadata = {
  title: "Authorize stellar CLI",
  description: "Approve a `stellar auth` login from your terminal.",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ code?: string | string[] }>;
};

/**
 * Where `stellar auth` sends the browser. Shows the pending login and lets the
 * signed-in user approve or deny it - deliberately never on its own, not even
 * right after the login redirect: approving hands a terminal access to the
 * account, so it always takes a click on a page that says what is approved.
 */
export default async function CliAuthorizePage({ searchParams }: PageProps) {
  const { code: rawCode } = await searchParams;
  const codeParam = typeof rawCode === "string" ? rawCode.trim() : "";

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    const here = codeParam
      ? `/cli/authorize?code=${encodeURIComponent(codeParam)}`
      : "/cli/authorize";
    redirect(`/login?callbackUrl=${encodeURIComponent(here)}`);
  }

  if (!codeParam) {
    return (
      <AuthShell>
        <Heading>Authorize stellar CLI</Heading>
        <p className="mt-4 text-sm leading-relaxed text-ctp-subtext0">
          Enter the code <code className="text-ctp-subtext1">stellar auth</code>{" "}
          printed in your terminal.
        </p>
        <CodeEntry />
      </AuthShell>
    );
  }

  const userCode = normalizeUserCode(codeParam);
  const request = userCode
    ? await db.query.cliAuthRequests.findFirst({
        where: eq(cliAuthRequests.userCode, userCode),
      })
    : undefined;

  if (!request) {
    return (
      <AuthShell>
        <Heading>Unknown code</Heading>
        <p className="mt-4 text-sm leading-relaxed text-ctp-subtext0">
          <span className="font-mono text-ctp-text">{codeParam}</span> isn't a
          pending login. It may be mistyped, or it was already used - run{" "}
          <code className="text-ctp-subtext1">stellar auth</code> again for a
          fresh one.
        </p>
        <CodeEntry />
      </AuthShell>
    );
  }

  const shownCode = formatUserCode(request.userCode);

  if (request.expiresAt <= new Date()) {
    return (
      <AuthShell>
        <StatusIcon tone="muted" />
        <Heading>This code expired</Heading>
        <p className="mt-4 text-sm leading-relaxed text-ctp-subtext0">
          Login codes are only valid for 10 minutes. Run{" "}
          <code className="text-ctp-subtext1">stellar auth</code> again in your
          terminal to get a new one.
        </p>
      </AuthShell>
    );
  }

  if (request.status !== "pending") {
    if (request.userId !== session.user.id) {
      return (
        <AuthShell>
          <StatusIcon tone="red" />
          <Heading>Code already used</Heading>
          <p className="mt-4 text-sm leading-relaxed text-ctp-subtext0">
            <span className="font-mono text-ctp-text">{shownCode}</span> was
            already approved or denied by someone else. If you didn't expect
            that, run <code className="text-ctp-subtext1">stellar auth</code>{" "}
            again.
          </p>
        </AuthShell>
      );
    }

    return (
      <AuthShell>
        <DecisionResult
          decision={request.status === "approved" ? "approved" : "denied"}
        />
      </AuthShell>
    );
  }

  // The handle is always set in the database, but better-auth types it as
  // optional on the session, so read it from the row.
  const me = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: { username: true },
  });

  return (
    <AuthShell>
      <AuthorizeForm
        code={shownCode}
        username={me?.username ?? session.user.name}
        client={request.client}
        requestedAgo={formatTimeAgo(request.createdAt)}
        differentNetwork={
          getClientIPFromHeaders(requestHeaders) !== request.ipHash
        }
      />
    </AuthShell>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl font-bold text-ctp-text">{children}</h1>;
}

function StatusIcon({ tone }: { tone: "red" | "muted" }) {
  if (tone === "red") {
    return <CircleX size={40} className="mb-4 text-ctp-red" />;
  }
  return <Clock size={40} className="mb-4 text-ctp-overlay1" />;
}

/** A plain GET form, so entering a code works before any JS has loaded. */
function CodeEntry() {
  return (
    <>
      <form method="get" action="/cli/authorize" className="mt-6 flex gap-2">
        <label htmlFor="cli-code" className="sr-only">
          Code
        </label>
        <input
          id="cli-code"
          name="code"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="WDJB-MJHT"
          maxLength={20}
          className="w-full rounded-lg border-2 border-ctp-crust bg-ctp-mantle p-2 font-mono uppercase tracking-widest text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0"
        />
        <button
          type="submit"
          className="shrink-0 cursor-pointer rounded-lg border-2 border-ctp-subtext0 bg-ctp-text px-4 font-semibold text-ctp-base transition hover:bg-ctp-subtext1"
        >
          Continue
        </button>
      </form>
      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ctp-subtext0">
        <TerminalSquare size={14} className="mt-0.5 shrink-0" />
        <span>
          Not sure where this comes from? See{" "}
          <Link
            href="/docs/publishing"
            className="text-ctp-lavender underline underline-offset-2"
          >
            publishing from the CLI
          </Link>
          .
        </span>
      </p>
    </>
  );
}
