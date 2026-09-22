"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import AuthShell from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailId = useId();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const { error: requestError } = await authClient.forgetPassword({
      email,
      redirectTo: "/reset-password",
    });

    if (requestError) {
      setError(
        requestError.message ??
          "Could not send the reset link. Please try again.",
      );
      setPending(false);
      return;
    }

    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <AuthShell>
        <h1 className="text-3xl font-bold text-ctp-text">Check your inbox</h1>
        <p className="mt-4 text-sm leading-relaxed text-ctp-subtext0">
          If an account exists for{" "}
          <span className="text-ctp-text">{email}</span>, we&apos;ve sent a
          reset link. Open it to choose a new password.
        </p>
        <p className="mt-6 text-sm text-ctp-subtext0">
          Nothing arrived? Check your spam folder, or{" "}
          <Link
            href="/login"
            className="text-ctp-lavender underline underline-offset-4"
          >
            back to log in
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-bold text-ctp-text">Reset password</h1>
      <p className="mt-3 text-sm leading-relaxed text-ctp-subtext0">
        Enter the email address on your account and we&apos;ll send you a link
        to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div>
          <label
            htmlFor={emailId}
            className="mb-1.5 block text-sm text-ctp-text"
          >
            Email
          </label>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-lg border-2 border-ctp-crust bg-ctp-mantle p-2 text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-ctp-red/40 bg-ctp-red/10 px-3 py-2 text-sm text-ctp-red">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-ctp-lavender px-4 py-3 text-sm font-semibold text-ctp-crust transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Loader2 size={16} className="animate-spin" />}
          Send reset link
        </button>

        <Link
          href="/login"
          className="text-center text-sm text-ctp-subtext0 transition-colors hover:text-ctp-text"
        >
          Back to log in
        </Link>
      </form>
    </AuthShell>
  );
}
