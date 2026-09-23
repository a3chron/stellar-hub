"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useId, useState } from "react";
import AuthShell from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";
import {
  PASSWORD_MIN_LENGTH,
  passwordConfirmFeedback,
  passwordLengthFeedback,
} from "@/lib/password-feedback";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newFocused, setNewFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const newPasswordId = useId();
  const confirmPasswordId = useId();

  const lengthFeedback = passwordLengthFeedback(newPassword, newFocused);
  const confirmFeedback = passwordConfirmFeedback(
    newPassword,
    confirmPassword,
    confirmFocused,
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!token) {
      setError("This link is invalid or expired.");
      return;
    }

    setPending(true);

    const { error: resetError } = await authClient.resetPassword({
      newPassword,
      token,
    });

    if (resetError) {
      setError(
        resetError.message ??
          "Could not reset your password. Please try again.",
      );
      setPending(false);
      return;
    }

    setPending(false);
    setDone(true);
    // Navigating in the same tick means the confirmation below never paints -
    // the user lands back on a login form with no sign the password actually
    // changed. Give them a moment to read it first.
    setTimeout(() => router.push("/login"), 1500);
  }

  if (linkError || !token) {
    return (
      <AuthShell>
        <h1 className="text-3xl font-bold text-ctp-text">Link expired</h1>
        <p className="mt-4 text-sm leading-relaxed text-ctp-subtext0">
          This password reset link is invalid or has expired. Request a new one
          to continue.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm text-ctp-lavender underline underline-offset-4"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell>
        <h1 className="text-3xl font-bold text-ctp-text">Password updated</h1>
        <p className="mt-4 text-sm leading-relaxed text-ctp-subtext0">
          Your password has been reset. Taking you to log in...
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-bold text-ctp-text">
        Choose a new password
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ctp-subtext0">
        Enter a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div>
          <label
            htmlFor={newPasswordId}
            className="mb-1.5 block text-sm text-ctp-text"
          >
            New password
          </label>
          <div className="relative">
            <input
              id={newPasswordId}
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              onFocus={() => setNewFocused(true)}
              onBlur={() => setNewFocused(false)}
              aria-invalid={lengthFeedback.showTooShort}
              aria-describedby={`${newPasswordId}-hint`}
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
              className={`w-full rounded-lg border-2 bg-ctp-mantle p-2 pr-9 text-ctp-text placeholder:text-ctp-overlay0 transition-colors focus:outline-none focus:ring-2 ${lengthFeedback.stateClass}`}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((visible) => !visible)}
              aria-label={showNewPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-ctp-overlay0 transition-colors hover:text-ctp-text"
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p
            id={`${newPasswordId}-hint`}
            className={`mt-1.5 text-xs transition-colors ${
              lengthFeedback.showTooShort ? "text-ctp-red" : "text-ctp-subtext0"
            }`}
          >
            At least {PASSWORD_MIN_LENGTH} characters.
          </p>
        </div>

        <div>
          <label
            htmlFor={confirmPasswordId}
            className="mb-1.5 block text-sm text-ctp-text"
          >
            Confirm password
          </label>
          <div className="relative">
            <input
              id={confirmPasswordId}
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
              aria-invalid={confirmFeedback.mismatch}
              aria-describedby={`${confirmPasswordId}-hint`}
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
              className={`w-full rounded-lg border-2 bg-ctp-mantle p-2 pr-9 text-ctp-text placeholder:text-ctp-overlay0 transition-colors focus:outline-none focus:ring-2 ${confirmFeedback.stateClass}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
              className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-ctp-overlay0 transition-colors hover:text-ctp-text"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* Silent until there is something worth saying: a match, or a
              confirmation that has already diverged from the password. A
              correct-so-far prefix is just someone still typing. */}
          <p
            id={`${confirmPasswordId}-hint`}
            aria-live="polite"
            className="mt-1.5 text-xs"
          >
            {confirmFeedback.matches && (
              <span className="text-ctp-green">Passwords match</span>
            )}
            {confirmFeedback.mismatch && (
              <span className="text-ctp-red">Passwords don't match</span>
            )}
          </p>
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
          Reset password
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <div className="text-ctp-subtext0">Loading...</div>
        </AuthShell>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
