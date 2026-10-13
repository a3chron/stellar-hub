"use client";

import { ArrowLeft, ArrowRight, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef } from "react";
import LegalLink from "@/components/legal-link";
import { LocalDate } from "@/components/local-time";
import type { ApiErrorBody, Draft } from "@/lib/draft-shared";
import { existingDraftCode } from "@/lib/drafts-client";
import type { WizardStep } from "./stepper";

// Building blocks shared by the theme and version wizards.

const FIELD_LABELS: Record<string, string> = {
  name: "Theme Name",
  slug: "Slug",
  description: "Description",
  group: "Group",
  colorMode: "Theme Mode",
  colorSchemeId: "Color Scheme",
  dependencies: "Dependencies",
  minStarshipVersion: "Minimum Starship Version",
  version: "Version",
  versionNotes: "Version Notes",
  config: "Starship Config",
  source: "Source",
};

/** "Theme Name: must be 100 characters or less" for a validation error. */
function describe(error: ApiErrorBody): string {
  if (error.code === "validation_failed" && error.details) {
    const [field, messages] =
      Object.entries(error.details as Record<string, string[]>)[0] ?? [];
    if (field && messages?.[0]) {
      return `${FIELD_LABELS[field] ?? field}: ${messages[0]}`;
    }
  }
  return error.error;
}

export function ErrorBox({ error }: { error: ApiErrorBody }) {
  const pathname = usePathname();
  const draftCode = existingDraftCode(error);
  const sessionExpired = error.code === "unauthorized";

  let action: React.ReactNode = null;
  if (sessionExpired) {
    // A new tab, so whatever is filled in here survives signing in; back
    // here, the next try goes through.
    action = (
      <Link
        href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
        target="_blank"
        rel="noopener"
        className="underline"
      >
        Sign in again (opens a new tab), then try once more here
      </Link>
    );
  } else if (draftCode) {
    action = (
      <Link href={`/upload/${draftCode}`} className="underline">
        Continue that draft
      </Link>
    );
  } else if (error.code === "duplicate_slug") {
    action = (
      <Link href="/settings#themes" className="underline">
        Publish a new version from settings
      </Link>
    );
  } else if (error.code === "too_many_drafts") {
    action = (
      <Link href="/settings#drafts" className="underline">
        Manage your drafts
      </Link>
    );
  }

  // The API's messages mostly end without a full stop; the link is its own
  // sentence either way.
  const message = sessionExpired ? "Your session has expired" : describe(error);
  const separator = /[.!?]$/.test(message) ? " " : ". ";

  return (
    <p
      role="alert"
      className="text-sm text-ctp-red border-2 border-ctp-red/40 bg-ctp-mantle rounded-lg p-3"
    >
      {message}
      {action && (
        <>
          {separator}
          {action}.
        </>
      )}
    </p>
  );
}

// The primary button submits the surrounding <form>, so Enter in a field moves
// on too.
export function WizardNav({
  onBack,
  nextLabel,
  busy,
  nextDisabled = false,
}: {
  onBack: (() => void) | null;
  nextLabel: string;
  busy: boolean;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex gap-3 pt-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-3 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-lg border-2 border-ctp-surface1 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      )}
      <button
        type="submit"
        disabled={busy || nextDisabled}
        className="flex flex-1 items-center justify-center gap-2 bg-ctp-text hover:bg-ctp-subtext1 border-2 border-ctp-subtext0 text-ctp-base py-3 rounded-lg font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        {nextLabel}
        {!busy && nextLabel === "Next" && <ArrowRight size={16} />}
      </button>
    </div>
  );
}

/** Shown in place of the wizard once its draft has disappeared server-side. */
export function GoneBanner({
  kind,
  onStartOver,
  busy,
  error,
}: {
  kind: Draft["kind"];
  onStartOver: () => void;
  busy: boolean;
  error: ApiErrorBody | null;
}) {
  return (
    <div className="space-y-4 rounded-lg border-2 border-ctp-peach/40 bg-ctp-mantle p-6">
      <h2 className="text-xl font-semibold text-ctp-text">
        This draft expired, was published or deleted
      </h2>
      <p className="text-sm text-ctp-subtext0 leading-relaxed">
        Everything you entered on this page is still here. Start a new draft
        with it
        {kind === "theme" && " - only the screenshot has to be added again"}.
      </p>
      {error && <ErrorBox error={error} />}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onStartOver}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2 bg-ctp-text hover:bg-ctp-subtext1 border-2 border-ctp-subtext0 text-ctp-base rounded-lg font-semibold transition cursor-pointer disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RotateCcw size={16} />
          )}
          Start over with my inputs
        </button>
        <Link
          href="/settings#drafts"
          className="px-4 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-lg border-2 border-ctp-surface1 transition"
        >
          Your drafts
        </Link>
      </div>
    </div>
  );
}

/** "Draft K7QF2M · saved automatically, kept until 19.10.2026". */
export function DraftStatusLine({ draft }: { draft: Draft | null }) {
  if (!draft) {
    return (
      <p className="text-xs text-ctp-subtext0 -mt-4 mb-6">
        Your progress is saved as a draft from the first step on.
      </p>
    );
  }
  return (
    <p className="text-xs text-ctp-subtext0 -mt-4 mb-6">
      Draft <span className="font-mono text-ctp-subtext1">{draft.code}</span> ·
      saved as you go, kept until <LocalDate date={draft.expiresAt} />
    </p>
  );
}

export function ReviewRow({
  label,
  children,
  onEdit,
  missing = false,
}: {
  label: string;
  children: React.ReactNode;
  onEdit?: () => void;
  missing?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 sm:gap-4 py-3 border-b border-ctp-surface0 last:border-b-0">
      <dt className="w-24 sm:w-36 shrink-0 text-sm text-ctp-subtext0">
        {label}
      </dt>
      <dd className="flex-1 min-w-0 text-sm text-ctp-text break-words">
        {missing ? <span className="text-ctp-red">Missing</span> : children}
      </dd>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          className="shrink-0 text-xs text-ctp-lavender underline underline-offset-2 cursor-pointer"
        >
          Edit
        </button>
      )}
    </div>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-ctp-overlay1">{children}</span>;
}

/**
 * The field a failed save or publish was about, so the wizard can mark the
 * step that holds it: the first field of a validation error, or the field a
 * specific code implies.
 */
export function errorField(error: ApiErrorBody | null): string | null {
  if (!error) {
    return null;
  }
  switch (error.code) {
    case "draft_exists":
    case "duplicate_slug":
      return "slug";
    case "invalid_config":
      return "config";
    case "invalid_screenshot":
      return "screenshot";
    case "version_exists":
    case "version_not_newer":
      return "version";
    case "validation_failed": {
      const [field] = Object.keys(
        (error.details as Record<string, string[]> | undefined) ?? {},
      );
      return field ?? null;
    }
    default:
      return null;
  }
}

/**
 * The consent line on both Review steps. Its link opens in a new tab, so
 * reading the terms never leaves the wizard half saved.
 */
export function PublishConsent() {
  return (
    <p className="text-xs text-ctp-subtext0">
      By publishing, you confirm this theme follows the{" "}
      <LegalLink section="terms" newTab>
        terms of use
      </LegalLink>{" "}
      - in particular, no harmful{" "}
      <code className="text-ctp-subtext1">[custom]</code> commands.
    </p>
  );
}

/**
 * Moves focus to the step heading after a step change the user caused (Next,
 * Back, the stepper), so a screen reader announces the new step - but not on
 * the first load. Call `requestFocus()` right before changing the step.
 */
export function useStepFocus() {
  const pending = useRef(false);

  // A callback ref on a heading keyed by step runs exactly when the new
  // step's heading mounts.
  const headingRef = useCallback((heading: HTMLHeadingElement | null) => {
    if (heading && pending.current) {
      pending.current = false;
      heading.focus();
    }
  }, []);

  function requestFocus() {
    pending.current = true;
  }

  return { headingRef, requestFocus };
}

/** The visible name of the current step; render it with `key={step}`. */
export function StepHeading({
  step,
  headingRef,
}: {
  step: WizardStep;
  headingRef: (heading: HTMLHeadingElement | null) => void;
}) {
  return (
    <h2
      ref={headingRef}
      // Focus target only (see useStepFocus): the step change itself is what
      // shows where you are, so no outline.
      tabIndex={-1}
      className="text-xl font-semibold text-ctp-text focus:outline-none"
    >
      {step.label}
      {step.optional && (
        <span className="ml-2 text-sm font-normal text-ctp-overlay1">
          (optional)
        </span>
      )}
    </h2>
  );
}

/** "1 line", "42 lines" - for the config row of a review. */
export function lineCount(text: string): string {
  const lines = text.split("\n").length;
  return lines === 1 ? "1 line" : `${lines} lines`;
}
