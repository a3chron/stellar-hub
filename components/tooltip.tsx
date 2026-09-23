"use client";

import {
  cloneElement,
  type HTMLAttributes,
  isValidElement,
  type ReactElement,
  useId,
  useState,
} from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: ReactElement<HTMLAttributes<HTMLElement>>;
  /**
   * Extra classes for the tooltip bubble itself, e.g. `"max-w-xs
   * whitespace-normal"` to let a longer message wrap instead of overflowing
   * on narrow screens. Optional and additive - every existing caller keeps
   * today's single-line `whitespace-nowrap` bubble unless it opts in.
   */
  contentClassName?: string;
}

export default function Tooltip({
  content,
  children,
  contentClassName,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const id = useId();

  if (!isValidElement(children)) {
    throw new Error("Tooltip expects a single React element.");
  }

  const trigger = cloneElement(children, {
    "aria-describedby": id,

    onMouseEnter: (e) => {
      children.props.onMouseEnter?.(e);
      setIsVisible(true);
    },
    onMouseLeave: (e) => {
      children.props.onMouseLeave?.(e);
      setIsVisible(false);
    },
    onFocus: (e) => {
      children.props.onFocus?.(e);
      setIsVisible(true);
    },
    onBlur: (e) => {
      children.props.onBlur?.(e);
      setIsVisible(false);
    },
  });

  return (
    <div className="relative inline-block">
      {trigger}

      {isVisible && (
        <div
          id={id}
          role="tooltip"
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 text-sm text-ctp-crust bg-ctp-text rounded-lg z-10 shadow-lg",
            // `cn` here is a plain join, not a Tailwind-merge - keeping
            // `whitespace-nowrap` out of the base string when a caller
            // overrides it (rather than appending both) avoids depending on
            // Tailwind's generated CSS order to decide which one wins.
            contentClassName ?? "whitespace-nowrap",
          )}
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-ctp-text" />
        </div>
      )}
    </div>
  );
}
