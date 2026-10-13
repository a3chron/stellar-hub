"use client";

import { cn } from "@/lib/utils";

export interface WizardStep {
  id: string;
  label: string;
  optional?: boolean;
}

/**
 * - empty: nothing entered yet, nothing to complain about.
 * - partial: something is entered, but not everything the step requires.
 * - complete: every required field on the step is filled and valid.
 * - error: a field holds a value that is rejected right now, or something
 *   required is missing on a step the user has already moved past.
 */
export type StepStatus = "empty" | "partial" | "complete" | "error";

// What a bar shows. Deliberately fewer colours than statuses: a step is
// either fine (lavender, faded for an optional one), the one you're on
// (blue), wrong (red), or not done yet (neutral) - "in progress" doesn't get
// a colour of its own.
type BarTone = "error" | "current" | "done" | "doneOptional" | "neutral";

function barTone(
  stepStatus: StepStatus,
  isCurrent: boolean,
  optional: boolean,
): BarTone {
  // Red wins even on the current step: that's where the inline error is.
  if (stepStatus === "error") {
    return "error";
  }
  if (isCurrent) {
    return "current";
  }
  if (stepStatus === "complete") {
    return optional ? "doneOptional" : "done";
  }
  return "neutral";
}

const BAR_CLASS: Record<BarTone, string> = {
  error: "bg-ctp-red",
  current: "bg-ctp-blue",
  done: "bg-ctp-lavender",
  doneOptional: "bg-ctp-lavender/50",
  neutral: "bg-ctp-surface0",
};

// The current step's ring, in its bar's own colour, faded: blue, or red
// when the step you're on has a problem. Spelled out per tone so Tailwind
// finds every class name.
const RING_CLASS: Record<BarTone, string> = {
  error: "ring-ctp-red/40",
  current: "ring-ctp-blue/40",
  done: "ring-ctp-lavender/40",
  doneOptional: "ring-ctp-lavender/30",
  neutral: "ring-ctp-overlay0/50",
};

// Hovering a step you can jump to rings its bar in its own colour, faded.
// A neutral bar's surface colour would vanish against the page, so it gets a
// brighter grey. Spelled out in full so Tailwind finds every class name.
const HOVER_RING_CLASS: Record<BarTone, string> = {
  error: "group-hover:ring-ctp-red/40",
  current: "group-hover:ring-ctp-blue/40",
  done: "group-hover:ring-ctp-lavender/40",
  doneOptional: "group-hover:ring-ctp-lavender/30",
  neutral: "group-hover:ring-ctp-overlay0/50",
};

// The colour doesn't say anything to a screen reader, so every status but
// "empty" is also spelled out for one.
const STATUS_TEXT: Record<StepStatus, string | null> = {
  empty: null,
  partial: "in progress",
  complete: "complete",
  error: "needs attention",
};

/**
 * Folds a step's facts into its status. `invalid` wins at once, even on the
 * step the user is on - it is what an inline error is showing right now.
 * Something merely missing only turns red once the user has `passed` the
 * step (left it, or is on a later one), so typing is never punished.
 */
export function resolveStepStatus({
  invalid = false,
  complete,
  started,
  missing = false,
  passed,
}: {
  invalid?: boolean;
  complete: boolean;
  started: boolean;
  missing?: boolean;
  passed: boolean;
}): StepStatus {
  if (invalid) {
    return "error";
  }
  if (complete) {
    return "complete";
  }
  if (missing && passed) {
    return "error";
  }
  return started ? "partial" : "empty";
}

interface StepperProps {
  steps: WizardStep[];
  current: number;
  // Highest step index reached so far - everything up to it is clickable.
  furthest: number;
  // Per step id. The wizards derive it from the same values that enable
  // their Next and Publish buttons, so the bars never disagree with them.
  status: Record<string, StepStatus>;
  onSelect: (index: number) => void;
}

/**
 * The wizard's progress: one rounded bar per step - blue for the current
 * one, lavender once a step is complete (faded for an optional one), red
 * when it needs attention, neutral otherwise (see barTone). The current
 * step also gets a faded ring in its bar's colour and a bold label, and each
 * status is spelled out for screen readers. On a phone, where five labels
 * don't fit, one line below the bars says "Step 4 of 5 · Details" instead. Steps already reached are
 * buttons, so you can jump back (or forward again) without paging through
 * every step in between.
 */
export default function Stepper({
  steps,
  current,
  furthest,
  status,
  onSelect,
}: StepperProps) {
  const currentStep = steps[current];

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex gap-2">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          const reachable = index <= furthest;
          const stepStatus = status[step.id] ?? "empty";
          const statusText = STATUS_TEXT[stepStatus];
          const tone = barTone(stepStatus, isCurrent, !!step.optional);

          let labelClass = "text-ctp-subtext0";
          if (isCurrent) {
            labelClass = "text-ctp-text font-semibold";
          } else if (step.optional) {
            labelClass = "text-ctp-overlay1";
          }

          return (
            <li key={step.id} className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={!reachable || isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                // The gap, not a margin on the label: `not-sr-only` resets margins, so a
                // label margin only ever applied to the current step.
                className="group flex w-full flex-col gap-2 text-left cursor-pointer disabled:cursor-default"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-colors",
                    BAR_CLASS[tone],
                    isCurrent &&
                      `ring-2 ring-offset-2 ring-offset-ctp-base ${RING_CLASS[tone]}`,
                    reachable &&
                      !isCurrent &&
                      `group-hover:ring-1 group-hover:ring-offset-1 group-hover:ring-offset-ctp-base ${HOVER_RING_CLASS[tone]}`,
                  )}
                />
                <span
                  className={cn(
                    // On a phone the line below the bars says where you are;
                    // the per-step labels stay for screen readers.
                    "sr-only sm:not-sr-only sm:flex items-center gap-1.5 text-xs",
                    labelClass,
                  )}
                >
                  <span className="truncate">{step.label}</span>
                  {step.optional && (
                    <span className="text-ctp-overlay0 font-normal">
                      (optional)
                    </span>
                  )}
                  {statusText && (
                    <span className="sr-only">({statusText})</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {currentStep && (
        // Already said by the labels above for screen readers.
        <p
          aria-hidden="true"
          className="mt-2 text-xs text-ctp-subtext0 sm:hidden"
        >
          Step {current + 1} of {steps.length} ·{" "}
          <span className="font-semibold text-ctp-text">
            {currentStep.label}
          </span>
          {currentStep.optional && " (optional)"}
        </p>
      )}
    </nav>
  );
}
