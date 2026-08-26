"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}

// Roughly max-h-60 (240px) plus margins: used to decide whether the popup
// still fits below the trigger or should flip above it.
const POPUP_SPACE = 272;
// Tailwind's max-h-60, as a number - the popup never grows past this even
// when there's more room.
const POPUP_MAX_HEIGHT = 240;
// Gap between trigger and popup (Tailwind's mt-2/mb-2).
const POPUP_GAP = 8;

export default function Select({
  options,
  value,
  defaultValue,
  onChange,
  name,
  label,
  ariaLabel,
  placeholder = "Select…",
  className,
}: SelectProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options[0]?.value ?? "",
  );
  const currentValue = isControlled ? (value as string) : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // The popup is positioned in viewport coordinates rather than relative to
  // the trigger, because `position: absolute` cannot escape a clipping
  // ancestor: inside the edit-metadata modal (max-h-[90vh] overflow-y-auto,
  // which computes overflow-x to auto as well) the option list was cut off
  // at the modal's edge and no z-index could rescue it. Fixed positioning is
  // not clipped by an ancestor's overflow, so the list is always fully
  // visible - at the cost of having to re-measure on scroll and resize.
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeaheadBufferRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only keyboard navigation may auto-scroll the list; doing it for
  // mouse-hover would fight the user's own wheel scrolling.
  const keyboardNavRef = useRef(false);

  const baseId = useId();
  const labelId = `${baseId}-label`;
  const listboxId = `${baseId}-listbox`;

  const selectedIndex = options.findIndex((o) => o.value === currentValue);
  const selectedOption =
    selectedIndex >= 0 ? options[selectedIndex] : undefined;

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Don't leave the typeahead timer running past unmount (closing the edit
  // modal unmounts mid-buffer).
  useEffect(
    () => () => {
      if (typeaheadTimerRef.current) {
        clearTimeout(typeaheadTimerRef.current);
      }
    },
    [],
  );

  // Keep the keyboard-active option in view while navigating
  useEffect(() => {
    if (isOpen && keyboardNavRef.current) {
      keyboardNavRef.current = false;
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, activeIndex]);

  function commitValue(newValue: string) {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  // Measures the trigger and pins the popup just below it, flipping above
  // when there isn't room below (e.g. near the bottom of the viewport).
  const positionPopup = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const up = spaceBelow < POPUP_SPACE && rect.top > spaceBelow;
    const available = (up ? rect.top : spaceBelow) - POPUP_GAP * 2;

    setPopupStyle({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(POPUP_MAX_HEIGHT, Math.max(available, 0)),
      ...(up
        ? { bottom: window.innerHeight - rect.top + POPUP_GAP }
        : { top: rect.bottom + POPUP_GAP }),
    });
  }, []);

  // Viewport coordinates go stale the moment anything scrolls. The listener
  // is capturing so it also sees scrolls of the modal's own container, which
  // don't bubble.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.addEventListener("scroll", positionPopup, true);
    window.addEventListener("resize", positionPopup);
    return () => {
      window.removeEventListener("scroll", positionPopup, true);
      window.removeEventListener("resize", positionPopup);
    };
  }, [isOpen, positionPopup]);

  function openWithActive(index: number, fromKeyboard: boolean) {
    positionPopup();
    // Only a keyboard open scrolls the active option into view. Doing it for
    // a mouse click could scroll the page out from under the cursor - and
    // now that the page scrolls smoothly, animate it too.
    keyboardNavRef.current = fromKeyboard;
    setActiveIndex(index < 0 ? 0 : index);
    setIsOpen(true);
  }

  function handleTypeahead(char: string) {
    if (typeaheadTimerRef.current) {
      clearTimeout(typeaheadTimerRef.current);
    }
    typeaheadBufferRef.current += char.toLowerCase();
    const buffer = typeaheadBufferRef.current;
    typeaheadTimerRef.current = setTimeout(() => {
      typeaheadBufferRef.current = "";
    }, 500);

    const matchIndex = options.findIndex((o) =>
      o.label.toLowerCase().startsWith(buffer),
    );
    if (matchIndex === -1) {
      return;
    }

    if (isOpen) {
      keyboardNavRef.current = true;
      setActiveIndex(matchIndex);
    } else {
      commitValue(options[matchIndex].value);
    }
  }

  function moveActive(updater: (current: number) => number) {
    keyboardNavRef.current = true;
    setActiveIndex(updater);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const key = e.key;

    // A printable key types ahead, but only on its own: Ctrl+R, Ctrl+F, Cmd+S
    // and friends belong to the browser, and treating them as typeahead would
    // both swallow the shortcut and (for Ctrl+D on "Dark") silently change
    // the selected value.
    const isTypeaheadKey =
      key.length === 1 &&
      /\S/.test(key) &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey;

    if (!isOpen) {
      if (
        key === "Enter" ||
        key === " " ||
        key === "ArrowDown" ||
        key === "ArrowUp"
      ) {
        e.preventDefault();
        openWithActive(selectedIndex, true);
        return;
      }
      if (isTypeaheadKey) {
        e.preventDefault();
        handleTypeahead(key);
      }
      return;
    }

    switch (key) {
      case "ArrowDown":
        e.preventDefault();
        moveActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        moveActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        moveActive(() => 0);
        break;
      case "End":
        e.preventDefault();
        moveActive(() => options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (options[activeIndex]) {
          commitValue(options[activeIndex].value);
        }
        break;
      case "Escape":
        // Consume the key so a surrounding modal's Escape handler doesn't
        // also fire while the user only meant to close the dropdown.
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        if (isTypeaheadKey) {
          e.preventDefault();
          handleTypeahead(key);
        }
    }
  }

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-controls={listboxId}
      aria-activedescendant={isOpen ? `${listboxId}-${activeIndex}` : undefined}
      aria-labelledby={label ? labelId : undefined}
      aria-label={ariaLabel}
      onClick={() => {
        if (isOpen) {
          setIsOpen(false);
        } else {
          openWithActive(selectedIndex, false);
        }
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "w-full p-2 px-4 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-ctp-text text-sm font-medium text-left flex items-center justify-between gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base",
        className,
      )}
    >
      <span className={cn(!selectedOption && "text-ctp-subtext0")}>
        {selectedOption?.label ?? placeholder}
      </span>
      <ChevronDown
        size={16}
        className={cn("transition-transform shrink-0", isOpen && "rotate-180")}
      />
    </button>
  );

  const popup = isOpen && (
    <div
      id={listboxId}
      role="listbox"
      aria-labelledby={label ? labelId : undefined}
      style={popupStyle}
      className="fixed z-50 min-w-max overflow-auto rounded-lg border-2 border-ctp-surface0 bg-ctp-mantle shadow-lg py-1"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(el) => {
            optionRefs.current[index] = el;
          }}
          type="button"
          id={`${listboxId}-${index}`}
          role="option"
          aria-selected={option.value === currentValue}
          tabIndex={-1}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => commitValue(option.value)}
          className={cn(
            "w-full px-3 py-2 text-sm flex items-center justify-between cursor-pointer text-left",
            index === activeIndex && "bg-ctp-surface0",
          )}
        >
          <span>{option.label}</span>
          {option.value === currentValue && (
            <Check size={14} className="text-ctp-text shrink-0" />
          )}
        </button>
      ))}
    </div>
  );

  const hiddenInput = name && (
    <input type="hidden" name={name} value={currentValue} />
  );

  const control = (
    <div className="relative" ref={containerRef}>
      {trigger}
      {popup}
      {hiddenInput}
    </div>
  );

  if (label) {
    return (
      <div className="flex flex-col">
        <span id={labelId} className="mb-1.5 text-sm">
          {label}
        </span>
        {control}
      </div>
    );
  }

  return control;
}
