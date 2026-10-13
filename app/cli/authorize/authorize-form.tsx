"use client";

import {
  AtSign,
  CircleCheck,
  CircleX,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import LegalLink from "@/components/legal-link";
import { CLI_LOGIN_NAME_MAX_LENGTH } from "@/lib/cli-login-name";

type Decision = "approved" | "denied";

interface AuthorizeFormProps {
  code: string;
  username: string;
  client: string;
  requestedAgo: string;
  // The approving browser's IP hash differs from the one that started the
  // login - the classic sign of someone sending you their login link.
  differentNetwork: boolean;
  // Prefilled into the name field - derived from the client string, so it
  // says the same thing the client line above does, just friendlier.
  defaultName: string;
}

export default function AuthorizeForm({
  code,
  username,
  client,
  requestedAgo,
  differentNetwork,
  defaultName,
}: AuthorizeFormProps) {
  const nameId = useId();
  const [name, setName] = useState(defaultName);
  const [result, setResult] = useState<Decision | null>(null);
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "deny") {
    setPending(action);
    setError(null);

    try {
      const response = await fetch("/api/cli/auth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only an approval carries the name; Deny ignores the field.
        body: JSON.stringify(
          action === "approve"
            ? { userCode: code, action, name }
            : { userCode: code, action },
        ),
      });
      const body = await response.json().catch(() => null);

      if (
        response.ok &&
        (body?.status === "approved" || body?.status === "denied")
      ) {
        setResult(body.status);
        return;
      }
      const nameProblem: string | undefined = body?.details?.name?.[0];
      if (nameProblem) {
        setError(`The name ${nameProblem}.`);
        return;
      }
      setError(body?.error ?? `Something went wrong (${response.status})`);
    } catch {
      setError(
        "Could not reach the server - check your connection and try again.",
      );
    } finally {
      setPending(null);
    }
  }

  if (result) {
    return <DecisionResult decision={result} focusOnMount />;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-ctp-text">
        Authorize stellar-cli
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ctp-subtext0">
        Check that this code matches the one in your terminal:
      </p>

      <p className="mt-6 rounded-lg border-2 border-ctp-surface0 bg-ctp-mantle py-4 text-center font-mono text-3xl font-bold tracking-[0.2em] text-ctp-text">
        {code}
      </p>

      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-ctp-text">
          <AtSign size={14} className="shrink-0 text-ctp-overlay1" />
          <dt className="sr-only">Account</dt>
          <dd>
            Approving as <span className="font-semibold">@{username}</span>
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2 text-ctp-subtext0">
          <dt className="sr-only">Client</dt>
          <dd className="font-mono text-xs leading-5">{client}</dd>
          <dt className="sr-only">Requested</dt>
          <dd className="text-xs leading-5">· requested {requestedAgo}</dd>
        </div>
      </dl>

      {differentNetwork && (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-lg border border-ctp-red/40 bg-ctp-red/10 p-4"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-ctp-red" />
          <p className="text-sm leading-relaxed text-ctp-text">
            This login request came from a different network than the one you're
            on now. If someone sent you this link, Deny. That's expected if you
            ran stellar auth on another machine, e.g. over SSH.
          </p>
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-ctp-subtext0">
        Approving lets that terminal create drafts and publish new themes and
        new versions of your existing themes as you, until you revoke it. It
        can't change anything else on your account.
      </p>
      <p className="mt-2 text-xs text-ctp-subtext0">
        Themes published from that terminal are subject to the{" "}
        <LegalLink section="terms" newTab>
          terms of use
        </LegalLink>
        .
      </p>

      <div className="mt-6">
        <label htmlFor={nameId} className="block text-sm text-ctp-text mb-1.5">
          Name this login
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={CLI_LOGIN_NAME_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${nameId}-hint`}
          className="w-full rounded-lg border-2 border-ctp-crust bg-ctp-mantle p-2 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0"
        />
        <p id={`${nameId}-hint`} className="mt-1.5 text-xs text-ctp-subtext0">
          Optional. Helps you tell your logins apart in settings.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-ctp-red">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => decide("deny")}
          disabled={pending !== null}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-ctp-surface1 bg-ctp-surface0 px-4 py-3 text-sm font-medium text-ctp-text transition hover:bg-ctp-surface1 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "deny" && <Loader2 size={16} className="animate-spin" />}
          Deny
        </button>
        <button
          type="button"
          onClick={() => decide("approve")}
          disabled={pending !== null}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-ctp-subtext0 bg-ctp-text px-4 py-3 text-sm font-semibold text-ctp-base transition hover:bg-ctp-subtext1 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "approve" && (
            <Loader2 size={16} className="animate-spin" />
          )}
          Approve
        </button>
      </div>
    </div>
  );
}

/**
 * What's left once the login was approved or denied (also after a reload).
 * Right after a click the heading takes focus, so a screen reader announces
 * the outcome instead of losing focus with the removed buttons.
 */
export function DecisionResult({
  decision,
  focusOnMount = false,
}: {
  decision: Decision;
  focusOnMount?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) {
      headingRef.current?.focus();
    }
  }, [focusOnMount]);

  if (decision === "denied") {
    return (
      <div>
        <CircleX size={40} className="mb-4 text-ctp-red" />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-bold text-ctp-text focus:outline-none"
        >
          Login denied
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ctp-subtext0">
          Nothing was shared with the CLI. You can close this tab.
        </p>
      </div>
    );
  }

  return (
    <div>
      <CircleCheck size={40} className="mb-4 text-ctp-green" />
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-bold text-ctp-text focus:outline-none"
      >
        You can close this tab
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ctp-subtext0">
        stellar-cli picks up the login by itself within a few seconds. You can
        revoke it anytime under{" "}
        <Link
          href="/settings#cli-logins"
          className="text-ctp-lavender underline underline-offset-2"
        >
          Settings → CLI logins
        </Link>
        .
      </p>
    </div>
  );
}
