"use client";

import { AlertCircle, Check } from "lucide-react";
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

const BAR_CLASS: Record<StepStatus, string> = {
  empty: "bg-ctp-surface0",
  partial: "bg-ctp-lavender",
  complete: "bg-ctp-green",
  error: "bg-ctp-red",
};

// Colour alone doesn't say anything to a screen reader (or to everyone who
// can't tell red from green), so every status but "empty" is also spelled out.
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
 * The wizard's progress: one rounded bar per step, coloured by the step's
 * status (see StepStatus) - neutral, lavender for in progress, green for
 * complete, red when it needs attention. The current step is marked by a
 * ring around its bar and a bold label instead of a colour of its own, and
 * complete or failing steps also carry an icon and screen-reader text.
 * Steps already reached are buttons, so you can jump back (or forward again)
 * without paging through every step in between.
 */
export default function Stepper({
  steps,
  current,
  furthest,
  status,
  onSelect,
}: StepperProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex gap-2">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          const reachable = index <= furthest;
          const stepStatus = status[step.id] ?? "empty";
          const statusText = STATUS_TEXT[stepStatus];

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
                className="group w-full text-left cursor-pointer disabled:cursor-default"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-colors",
                    BAR_CLASS[stepStatus],
                    isCurrent &&
                      "ring-2 ring-offset-2 ring-offset-ctp-base ring-ctp-overlay1",
                    reachable &&
                      !isCurrent &&
                      "group-hover:ring-1 group-hover:ring-offset-1 group-hover:ring-offset-ctp-base group-hover:ring-ctp-surface2",
                  )}
                />
                <span
                  className={cn(
                    "mt-2 items-center gap-1.5 text-xs",
                    labelClass,
                    // On a phone only the current step is labelled visibly;
                    // the others keep theirs for screen readers.
                    isCurrent ? "flex" : "sr-only sm:not-sr-only sm:flex",
                  )}
                >
                  <span className="truncate">{step.label}</span>
                  {step.optional && (
                    <span className="text-ctp-overlay0 font-normal">
                      (optional)
                    </span>
                  )}
                  {stepStatus === "complete" && (
                    <Check
                      size={12}
                      className="shrink-0 text-ctp-green"
                      aria-hidden="true"
                    />
                  )}
                  {stepStatus === "error" && (
                    <AlertCircle
                      size={12}
                      className="shrink-0 text-ctp-red"
                      aria-hidden="true"
                    />
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
    </nav>
  );
}
