"use client";

import { cn } from "@/lib/utils";

export interface WizardStep {
  id: string;
  label: string;
  optional?: boolean;
}

interface StepperProps {
  steps: WizardStep[];
  current: number;
  // Highest step index reached so far - everything up to it is clickable.
  furthest: number;
  // Step ids that still lack something required for publishing.
  missing: ReadonlySet<string>;
  onSelect: (index: number) => void;
}

/**
 * The wizard's progress: one rounded bar per step. Done steps are filled
 * lavender, the current one carries the accent and its label, a step that
 * still lacks something required gets a red dot, and optional steps stay
 * muted. Steps already visited are buttons, so you can jump back (or forward
 * again) without paging through every step in between.
 */
export default function Stepper({
  steps,
  current,
  furthest,
  missing,
  onSelect,
}: StepperProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex gap-2">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          const reachable = index <= furthest;
          const isMissing = reachable && missing.has(step.id);
          const isDone = reachable && !isCurrent && !isMissing;

          let barClass = "bg-ctp-surface0";
          if (isCurrent) {
            barClass = "bg-ctp-blue";
          } else if (isDone && !step.optional) {
            barClass = "bg-ctp-lavender";
          } else if (isDone) {
            barClass = "bg-ctp-lavender/50";
          } else if (isMissing) {
            barClass = "bg-ctp-surface1";
          }

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
                    barClass,
                    reachable &&
                      !isCurrent &&
                      "group-hover:ring-2 group-hover:ring-ctp-surface1",
                  )}
                />
                <span
                  className={cn(
                    "mt-2 items-center gap-1.5 text-xs",
                    labelClass,
                    // On a phone only the current step is labelled.
                    isCurrent ? "flex" : "hidden sm:flex",
                  )}
                >
                  <span className="truncate">{step.label}</span>
                  {step.optional && (
                    <span className="text-ctp-overlay0 font-normal">
                      (optional)
                    </span>
                  )}
                  {isMissing && (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-ctp-red"
                      title="Still needed before publishing"
                    />
                  )}
                  {isMissing && <span className="sr-only">(incomplete)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
