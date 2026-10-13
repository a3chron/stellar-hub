"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps keyboard focus somewhere sensible when a confirmed delete removes the
 * row it started from. The dialog hands focus back to the row's button, and
 * a moment later the refreshed list drops that row - focus would end up on
 * the page body. Instead it moves to the same button of the next row (or the
 * previous one, for the last row), or to the section heading once the list
 * is empty.
 *
 * `keys` identifies the rows in display order. Call `removing(key)` once the
 * delete succeeded; give the heading `headingRef` (with tabIndex={-1}) and
 * each row's button `buttonRef(key)`.
 */
export function useFocusAfterRemoval(keys: string[]) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttons = useRef(new Map<string, HTMLElement>());
  const pending = useRef<{ removed: string; next: string | null } | null>(null);
  const keyList = keys.join("\n");

  function buttonRef(key: string) {
    return (element: HTMLElement | null) => {
      if (element) {
        buttons.current.set(key, element);
      } else {
        buttons.current.delete(key);
      }
    };
  }

  function removing(key: string) {
    const index = keys.indexOf(key);
    pending.current = {
      removed: key,
      next: keys[index + 1] ?? keys[index - 1] ?? null,
    };
  }

  useEffect(() => {
    const target = pending.current;
    if (!target || keyList.split("\n").includes(target.removed)) {
      return;
    }
    pending.current = null;
    const next = target.next ? buttons.current.get(target.next) : undefined;
    (next ?? headingRef.current)?.focus();
  }, [keyList]);

  return { headingRef, buttonRef, removing };
}
