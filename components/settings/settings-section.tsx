import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  /** The anchor: /settings#<id>. The CLI and other pages link to some. */
  id: string;
  title: string;
  /** Shown as a small badge after the title, like the section nav does. */
  count?: number;
  description?: React.ReactNode;
  /** A button or link at the right of the header ("Upload theme"). */
  action?: React.ReactNode;
  tone?: "default" | "danger";
  /**
   * For useFocusAfterRemoval: the heading becomes a focus target
   * (tabIndex -1) once a list in the section runs out of rows.
   */
  headingRef?: React.Ref<HTMLHeadingElement>;
  children: React.ReactNode;
}

/** One card on the settings page, with its heading, description and action. */
export default function SettingsSection({
  id,
  title,
  count,
  description,
  action,
  tone = "default",
  headingRef,
  children,
}: SettingsSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      // Clears the sticky 64px site header when jumped to by its anchor.
      className={cn(
        "scroll-mt-24 rounded-xl border bg-ctp-mantle p-4 sm:p-6",
        tone === "danger" ? "border-ctp-red/40" : "border-ctp-surface0",
      )}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-72">
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={headingRef ? -1 : undefined}
            className={cn(
              "flex items-center gap-2 text-xl font-semibold focus:outline-none",
              tone === "danger" ? "text-ctp-red" : "text-ctp-text",
            )}
          >
            {title}
            {count !== undefined && count > 0 && (
              <span className="rounded-full border border-ctp-surface1 bg-ctp-surface0 px-2 py-0.5 text-xs font-medium tabular-nums text-ctp-subtext1">
                {count}
              </span>
            )}
          </h2>
          {description && (
            <div className="mt-1.5 text-sm leading-relaxed text-ctp-subtext0">
              {description}
            </div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// The upload wizard's button vocabulary, shared by every settings section.
// Sizes are a separate argument rather than a class appended by the caller:
// two padding utilities on one element don't resolve by their order in the
// class attribute, so an appended `px-3` could silently lose.
const BUTTON_TONES = {
  primary:
    "border-ctp-subtext0 bg-ctp-text font-semibold text-ctp-base hover:bg-ctp-subtext1",
  secondary:
    "border-ctp-surface1 bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1",
  danger: "border-ctp-red/50 text-ctp-red hover:bg-ctp-red/10",
};
const BUTTON_SIZES = {
  md: "px-4 py-2",
  sm: "px-3 py-2",
  xs: "px-3 py-1",
};

export function buttonClass(
  tone: keyof typeof BUTTON_TONES,
  size: keyof typeof BUTTON_SIZES = "md",
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg border-2 text-sm transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
    BUTTON_TONES[tone],
    BUTTON_SIZES[size],
  );
}

/** An icon-only button whose icon turns red on hover; the caller sizes it. */
export const ICON_DELETE_BUTTON =
  "inline-flex shrink-0 items-center justify-center rounded-lg text-ctp-subtext0 transition hover:bg-ctp-red/10 hover:text-ctp-red cursor-pointer";

/**
 * A text field on the mantle card. Horizontal padding is left to the caller,
 * since a field with an icon inside needs more on that side.
 */
export const FIELD =
  "w-full rounded-lg border-2 border-ctp-surface0 bg-ctp-base py-2 text-ctp-text placeholder:text-ctp-overlay0 transition-colors focus:border-ctp-overlay1 focus:outline-none";
