"use client";

import { Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { GROUP_MAX_LENGTH } from "@/lib/draft-shared";
import type { ThemeGroup } from "@/lib/theme-groups";
import { cn } from "@/lib/utils";

type PickerOption =
  | { kind: "group"; name: string; count: number }
  | { kind: "create"; name: string };

interface GroupPickerProps {
  // The author's existing groups, most used first.
  groups: ThemeGroup[];
  // Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`), like
  // a native input.
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  // Submits the value with the surrounding <form> under this name.
  name?: string;
}

function themesLabel(count: number): string {
  return count === 1 ? "1 theme" : `${count} themes`;
}

/**
 * The theme group field: free text, with the author's existing groups as
 * suggestions (ARIA combobox pattern). Groups are matched by exact string,
 * so a case variant of an existing group ("Catppuccin" for "catppuccin") is
 * always turned into the existing spelling - when picked from the list and
 * when typed and left - instead of quietly starting a second group.
 */
export default function GroupPicker({
  groups,
  value,
  defaultValue = "",
  onChange,
  name,
}: GroupPickerProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const current = isControlled ? value : internalValue;

  const [open, setOpen] = useState(false);
  // Whether something was typed since the list opened. Until then it shows
  // every group, so a set value doesn't hide the others.
  const [filtering, setFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const hintId = `${baseId}-hint`;

  const query = current.trim();
  const lowerQuery = query.toLowerCase();
  const caseMatch = groups.find(
    (group) => group.name.toLowerCase() === lowerQuery,
  );

  let visibleGroups = groups;
  if (filtering && query) {
    visibleGroups = groups.filter((group) =>
      group.name.toLowerCase().includes(lowerQuery),
    );
  }
  const options: PickerOption[] = visibleGroups.map((group) => ({
    kind: "group",
    ...group,
  }));
  if (filtering && query && !caseMatch) {
    options.push({ kind: "create", name: query });
  }
  const showList = open && options.length > 0;

  function optionId(index: number) {
    return `${listboxId}-${index}`;
  }

  function update(next: string) {
    if (!isControlled) {
      setInternalValue(next);
    }
    onChange?.(next);
  }

  function openList() {
    if (open) {
      return;
    }
    setOpen(true);
    setFiltering(false);
    setActiveIndex(groups.findIndex((group) => group.name === current));
  }

  function closeList() {
    setOpen(false);
    setFiltering(false);
    setActiveIndex(-1);
  }

  /** The typed text, trimmed and in an existing group's spelling. */
  function commitTyped() {
    const next = caseMatch ? caseMatch.name : query;
    if (next !== current) {
      update(next);
    }
  }

  function choose(option: PickerOption) {
    update(option.name);
    closeList();
  }

  function moveActive(next: number) {
    setActiveIndex(next);
    document
      .getElementById(optionId(next))
      ?.scrollIntoView({ block: "nearest" });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!showList) {
          openList();
          return;
        }
        moveActive(Math.min(activeIndex + 1, options.length - 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        if (showList) {
          moveActive(Math.max(activeIndex - 1, 0));
        }
        return;
      case "Enter": {
        // Never submits the surrounding form - in the wizard that would also
        // move on to the next step.
        event.preventDefault();
        const option = showList ? options[activeIndex] : undefined;
        if (option) {
          choose(option);
        } else {
          commitTyped();
          closeList();
        }
        return;
      }
      case "Escape":
        if (open) {
          // preventDefault is what tells a surrounding Modal to stay open
          // (see components/modal.tsx).
          event.preventDefault();
          event.stopPropagation();
          closeList();
        }
        return;
      case "Tab":
        closeList();
        return;
      default:
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm text-ctp-text">
        Group (optional)
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          aria-describedby={hintId}
          value={current}
          onChange={(event) => {
            update(event.currentTarget.value);
            setOpen(true);
            setFiltering(true);
            setActiveIndex(-1);
          }}
          onFocus={openList}
          onClick={openList}
          onBlur={() => {
            commitTyped();
            closeList();
          }}
          onKeyDown={handleKeyDown}
          maxLength={GROUP_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. catppuccin"
          className="w-full p-2 pr-9 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
        />
        {current && (
          <button
            type="button"
            onClick={() => {
              update("");
              inputRef.current?.focus();
            }}
            aria-label="Clear group"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ctp-overlay1 hover:text-ctp-text hover:bg-ctp-surface0 transition cursor-pointer"
          >
            <X size={14} />
          </button>
        )}

        <div
          id={listboxId}
          role="listbox"
          aria-label="Your groups"
          hidden={!showList}
          className="absolute z-50 mt-2 w-full max-h-60 overflow-auto rounded-lg border-2 border-ctp-surface0 bg-ctp-mantle shadow-lg py-1"
        >
          {showList &&
            options.map((option, index) => {
              const isGroup = option.kind === "group";
              const label = isGroup
                ? `${option.name}, ${themesLabel(option.count)}`
                : `Create group “${option.name}”`;

              return (
                <button
                  key={`${option.kind}:${option.name}`}
                  id={optionId(index)}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={isGroup && option.name === current}
                  aria-label={label}
                  // Keeps focus (and the blur normalisation) in the input.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    "w-full px-3 py-2 text-sm flex items-center gap-2 cursor-pointer text-left text-ctp-text",
                    index === activeIndex && "bg-ctp-surface0",
                  )}
                >
                  {option.kind === "group" ? (
                    <>
                      <span className="truncate">{option.name}</span>
                      <span
                        aria-hidden="true"
                        className="ml-auto shrink-0 rounded-full bg-ctp-surface1 px-2 text-xs text-ctp-subtext0"
                      >
                        {option.count}
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} className="shrink-0 text-ctp-subtext0" />
                      <span className="truncate">
                        Create group “{option.name}”
                      </span>
                    </>
                  )}
                </button>
              );
            })}
        </div>
      </div>
      {name && <input type="hidden" name={name} value={current} />}
      <p id={hintId} className="text-xs text-ctp-subtext0 mt-1">
        Ties variants of one theme together, like the flavors of a Catppuccin
        port: each theme's page lists your other themes in the same group.{" "}
        {groups.length > 0
          ? "Pick one of yours or type a new name."
          : "You have no groups yet - type a name to start one."}
      </p>
    </div>
  );
}
