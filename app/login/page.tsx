"use client";

import { Check, Eye, EyeOff, Github, Gitlab, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useState } from "react";
import AuthShell from "@/components/auth/auth-shell";
import GoogleLogo from "@/components/icons/google";
import { authClient } from "@/lib/auth-client";
import {
  getLastLoginMethod,
  type LoginMethod,
  rememberLoginMethod,
  stashResetEmail,
} from "@/lib/login-hints";
import {
  usernameError,
  usernameStateClass,
  useUsernameAvailability,
} from "@/lib/use-username-availability";

type Mode = "signin" | "signup";

const SOCIAL_PROVIDERS = [
  { id: "github", label: "GitHub", Icon: Github },
  { id: "gitlab", label: "GitLab", Icon: Gitlab },
  { id: "google", label: "Google", Icon: GoogleLogo },
] as const;

type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]["id"];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const modeParam = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<Mode>(modeParam);
  // Seeding state from the query string only runs on mount, so navigating
  // between /login and /login?mode=signup within the app would re-render this
  // component without remounting it and leave the form on the old mode.
  const [lastModeParam, setLastModeParam] = useState<Mode>(modeParam);
  if (modeParam !== lastModeParam) {
    setLastModeParam(modeParam);
    setMode(modeParam);
  }
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  // Seconds left before the resend button re-enables. The endpoint sends real
  // mail to whatever address it is given, so a button that can be held down is
  // a way to mail-bomb someone; the server caps it too, but the client should
  // not be firing requests it knows will be refused.
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setResendCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();

  // Availability is checked as they type so the handle is settled before the
  // account exists - it is far harder to change afterwards (see
  // /api/settings/username).
  const usernameStatus = useUsernameAvailability(username, mode === "signup");

  // Read after mount: localStorage doesn't exist during the server render.
  const [lastMethod, setLastMethod] = useState<LoginMethod | null>(null);
  useEffect(() => {
    setLastMethod(getLastLoginMethod());
  }, []);

  async function handleResend() {
    setResendState("sending");
    // Deliberately not reporting whether it succeeded beyond "sent": the
    // failure modes here are a rate-limit refusal or a provider error, and
    // neither is something the reader can act on differently.
    await authClient
      .sendVerificationEmail({ email, callbackURL: callbackUrl })
      .catch(() => undefined);
    setResendState("sent");
    setResendCooldown(30);
  }

  const handleSocial = useCallback(
    async (provider: SocialProvider) => {
      setError(null);
      setPending(provider);
      const { error: socialError } = await authClient.signIn.social({
        provider,
        callbackURL: callbackUrl,
      });
      if (socialError) {
        setError(socialError.message ?? "Could not sign in. Please try again.");
        setPending(null);
        return;
      }
      // The client has set the provider redirect in motion by now; recorded
      // here rather than before the call so a refused start isn't marked.
      rememberLoginMethod(provider);
    },
    [callbackUrl],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending("email");

    if (mode === "signin") {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: callbackUrl,
      });
      if (signInError) {
        // better-auth mints and sends a fresh verification link before it
        // rejects an unverified sign-in, so this is the recovery path for a
        // confirmation mail that was lost, expired, or never went out - worth
        // saying plainly rather than leaving them staring at "not verified".
        if (signInError.code === "EMAIL_NOT_VERIFIED") {
          setVerificationSent(true);
          setPending(null);
          return;
        }
        setError(
          signInError.message ?? "Wrong email or password. Please try again.",
        );
        setPending(null);
        return;
      }
      rememberLoginMethod("email");
      router.push(callbackUrl);
      router.refresh();
      return;
    }

    const { error: signUpError } = await authClient.signUp.email({
      email,
      password,
      // The display name starts as the handle; it can be changed in settings,
      // where the handle cannot.
      name: username,
      username,
      callbackURL: callbackUrl,
    });

    if (signUpError) {
      setError(signUpError.message ?? "Could not create your account.");
      setPending(null);
      return;
    }

    rememberLoginMethod("email");
    // The account exists but the address is unconfirmed, so there is nothing
    // to redirect to yet - tell them to go and check their inbox.
    setVerificationSent(true);
    setPending(null);
  }

  if (verificationSent) {
    return (
      <AuthShell>
        <h1 className="text-3xl font-bold text-ctp-text">Check your inbox</h1>
        <p className="mt-4 text-sm leading-relaxed text-ctp-subtext0">
          We sent a confirmation link to{" "}
          <span className="text-ctp-text">{email}</span>. Open it to finish
          setting up your account - you'll need to confirm the address before
          you can publish themes.
        </p>
        <p className="mt-6 text-sm leading-relaxed text-ctp-subtext0">
          Nothing arrived? Check your spam folder first - then send it again.
        </p>

        <button
          type="button"
          onClick={handleResend}
          disabled={resendState === "sending" || resendCooldown > 0}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-ctp-surface0 bg-ctp-mantle px-4 py-3 text-sm font-medium text-ctp-text transition-colors hover:bg-ctp-surface0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resendState === "sending" && (
            <Loader2 size={16} className="animate-spin" />
          )}
          {resendCooldown > 0 && `Sent - resend in ${resendCooldown}s`}
          {resendCooldown === 0 && resendState === "sending" && "Sending..."}
          {resendCooldown === 0 &&
            resendState !== "sending" &&
            "Resend confirmation email"}
        </button>

        <p className="mt-6 text-sm text-ctp-subtext0">
          <button
            type="button"
            onClick={() => {
              setVerificationSent(false);
              setMode("signin");
            }}
            className="cursor-pointer text-ctp-lavender underline underline-offset-4"
          >
            Back to sign in
          </button>
        </p>
      </AuthShell>
    );
  }

  const isSignUp = mode === "signup";
  const usernameProblem = usernameError(usernameStatus);
  const usernameBlocked = isSignUp && usernameProblem !== null;
  const usernameClass =
    usernameStateClass(usernameStatus) ??
    "border-ctp-crust focus:ring-ctp-surface0";
  // Only worth pointing out to someone coming back to log in.
  const markedMethod = isSignUp ? null : lastMethod;
  const passwordValid = isSignUp && password.length >= 12;
  const passwordTooShort =
    isSignUp && password.length > 0 && password.length < 12;
  const showPasswordTooShort = passwordTooShort && !passwordFocused;

  let passwordStateClass = "border-ctp-crust focus:ring-ctp-surface0";
  if (passwordValid) {
    passwordStateClass = "border-ctp-green focus:ring-ctp-green/30";
  } else if (passwordTooShort) {
    passwordStateClass = passwordFocused
      ? "border-ctp-crust focus:ring-ctp-red/30"
      : "border-ctp-red";
  }

  return (
    <AuthShell>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-bold text-ctp-text">
          {isSignUp ? "Create account" : "Log in"}
        </h1>
        <button
          type="button"
          onClick={() => {
            setMode(isSignUp ? "signin" : "signup");
            setError(null);
          }}
          className="cursor-pointer text-sm font-medium text-ctp-lavender underline underline-offset-4 transition-colors hover:text-ctp-text"
        >
          {isSignUp ? "I have an account" : "Create an account"}
        </button>
      </div>

      {/* Kurt's point: nobody needs to be told to sign up just to use Stellar. */}
      <p className="mt-3 text-sm leading-relaxed text-ctp-subtext0">
        You only need an account to{" "}
        <span className="text-ctp-subtext1">upload and manage your themes</span>
        . Browsing the hub and applying themes with the CLI works without one.
      </p>

      <div className="mt-8 flex flex-col gap-2">
        {SOCIAL_PROVIDERS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleSocial(id)}
            disabled={pending !== null}
            className={`relative flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border bg-ctp-mantle px-4 py-3 text-sm font-medium text-ctp-text transition-colors hover:bg-ctp-surface0 disabled:cursor-not-allowed disabled:opacity-60 ${
              markedMethod === id
                ? "border-ctp-green/60 ring-2 ring-ctp-green/20"
                : "border-ctp-surface0"
            }`}
          >
            {pending === id ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Icon size={18} />
            )}
            Continue with {label}
            {markedMethod === id && (
              <span className="absolute right-3 text-xs font-normal text-ctp-green">
                Last used
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-ctp-surface0" />
        {markedMethod === "email" ? (
          <span className="text-xs uppercase tracking-wider text-ctp-green">
            or email · last used
          </span>
        ) : (
          <span className="text-xs uppercase tracking-wider text-ctp-overlay0">
            or
          </span>
        )}
        <span className="h-px flex-1 bg-ctp-surface0" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <div>
            <label
              htmlFor={usernameId}
              className="mb-1.5 block text-sm text-ctp-text"
            >
              Username
            </label>
            <div className="relative">
              <input
                id={usernameId}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="username"
                spellCheck={false}
                maxLength={39}
                placeholder="your-handle"
                className={`w-full rounded-lg border-2 bg-ctp-mantle p-2 pr-9 text-ctp-text placeholder:text-ctp-overlay0 transition-colors focus:outline-none focus:ring-2 ${usernameClass}`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {usernameStatus.state === "checking" && (
                  <Loader2
                    size={16}
                    className="animate-spin text-ctp-overlay0"
                  />
                )}
                {usernameStatus.state === "available" && (
                  <Check size={16} className="text-ctp-green" />
                )}
                {usernameProblem && <X size={16} className="text-ctp-red" />}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ctp-subtext0">
              {usernameProblem ? (
                <span className="text-ctp-red">{usernameProblem}</span>
              ) : (
                <>
                  Your themes live at{" "}
                  <span className="text-ctp-subtext1">
                    /{username || "your-handle"}/theme
                  </span>
                  . Pick carefully - it can't be changed once you publish.
                </>
              )}
            </p>
          </div>
        )}

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

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <label htmlFor={passwordId} className="text-sm text-ctp-text">
              Password
            </label>
            {!isSignUp && (
              <Link
                href="/forgot-password"
                onClick={() => stashResetEmail(email)}
                className="text-xs text-ctp-subtext0 transition-colors hover:text-ctp-text"
              >
                Forgot?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              id={passwordId}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              required
              minLength={isSignUp ? 12 : undefined}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              className={`w-full rounded-lg border-2 bg-ctp-mantle p-2 pr-9 text-ctp-text placeholder:text-ctp-overlay0 transition-colors focus:outline-none focus:ring-2 ${passwordStateClass}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-ctp-overlay0 transition-colors hover:text-ctp-text"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {isSignUp && (
            <p
              className={`mt-1.5 text-xs transition-colors ${
                showPasswordTooShort ? "text-ctp-red" : "text-ctp-subtext0"
              }`}
            >
              At least 12 characters.
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-ctp-red/40 bg-ctp-red/10 px-3 py-2 text-sm text-ctp-red">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending !== null || usernameBlocked}
          className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-ctp-lavender px-4 py-3 text-sm font-semibold text-ctp-crust transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "email" && (
            <Loader2 size={16} className="animate-spin" />
          )}
          {isSignUp ? "Create account" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <div className="text-ctp-subtext0">Loading...</div>
        </AuthShell>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
