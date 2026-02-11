"use client";

import {
  cloneElement,
  type HTMLAttributes,
  isValidElement,
  type ReactElement,
  useId,
  useState,
} from "react";

interface TooltipProps {
  content: string;
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}

export default function Tooltip({ content, children }: TooltipProps) {
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
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 text-sm text-ctp-crust bg-ctp-text rounded-lg whitespace-nowrap z-10 shadow-lg"
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-ctp-text" />
        </div>
      )}
    </div>
  );
}
