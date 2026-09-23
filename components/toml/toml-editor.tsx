"use client";

/**
 * TomlEditor
 * ----------
 * Drop-in replacement for a plain `<textarea>` used to edit Starship TOML
 * config. It layers a transparent, real `<textarea name=... >` over a
 * syntax-highlighted `<pre>` (the classic overlay technique): the textarea
 * still holds the actual value and is still what `new FormData(form)` reads
 * on submit, it's just invisible except for its caret and selection - the
 * `<pre>` behind it paints the colored text.
 *
 * Props mirror a native `<textarea>` so it swaps in with no other changes:
 *
 *   name          - required for FormData, forwarded as-is
 *   value / defaultValue + onChange(value) - controlled or uncontrolled,
 *                   same rule as a native textarea (pass `value` for
 *                   controlled; `onChange` receives the plain string, not
 *                   the event)
 *   required, placeholder, id, aria-*, rows (default 12) - forwarded as-is
 *   className     - applied to the *outer wrapper* (the visible box); the
 *                   textarea and the highlight overlay share one internal
 *                   style so they can never drift out of alignment
 *
 * Highlighting is best-effort and async (see use-toml-tokens): until the
 * grammar loads, the overlay shows plain text and the field is fully usable
 * throughout - nothing about typing or submitting waits on it.
 */
import type { CSSProperties, TextareaHTMLAttributes } from "react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TomlLineContent } from "./toml-line";
import { useTomlTokens } from "./use-toml-tokens";

interface TomlEditorProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  onChange?: (value: string) => void;
}

// Padding, font and line-height must be byte-identical between the textarea
// and the overlay `<pre>` - any difference and highlighted text drifts out
// from under the caret. Kept as one shared string rather than duplicated on
// both elements so they can't accidentally diverge in an edit later.
const SHARED_TEXT_STYLE =
  "p-3 text-xs font-mono leading-normal whitespace-pre-wrap break-words";
const SHARED_TEXT_TAB_SIZE: CSSProperties = { tabSize: 2 };

export function TomlEditor({
  value,
  defaultValue,
  onChange,
  className,
  rows = 12,
  id,
  ...props
}: TomlEditorProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() =>
    (defaultValue ?? "").toString(),
  );

  // Controlled callers already own the value - mirroring it into state via
  // an effect would lag a render behind on every change. State is only the
  // source of truth for the uncontrolled case.
  const shown = isControlled ? String(value ?? "") : internalValue;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const tokens = useTomlTokens(shown);
  const lines = shown.split("\n");

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    onChange?.(e.target.value);
  };

  const syncScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    // The mantle background lives here rather than on the `.shiki` pre below
    // - app/globals.css forces `.shiki` (and its descendants) to a
    // transparent background with `!important` so Shiki's own inline
    // background never fights the page theme, which would just as happily
    // eat a background painted directly on that element.
    <div className={cn("relative rounded-lg bg-ctp-mantle", className)}>
      {/* Highlight layer. Structurally identical to the textarea's own text
          box (same padding/font/border width, same block display, same
          scroll behaviour) but out of the tab order and never interactive -
          it exists purely to be seen through the transparent textarea on
          top. Any mismatch here (an inline-level textarea gets a descender
          gap a block-level pre doesn't) drifts the two elements' scrollable
          heights apart, and the wrong line ends up under the caret. */}
      <pre
        ref={preRef}
        aria-hidden="true"
        style={SHARED_TEXT_TAB_SIZE}
        className={cn(
          "shiki pointer-events-none absolute inset-0 m-0 block overflow-auto rounded-lg border-2 border-transparent text-ctp-text",
          SHARED_TEXT_STYLE,
        )}
      >
        {lines.map((line, index) => (
          // Lines are re-split from the value on every change, so there is
          // no stable identity beyond position.
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are recreated wholesale per render
          <div key={index}>
            <TomlLineContent text={line} tokens={tokens?.[index]} />
            {"\n"}
          </div>
        ))}
      </pre>

      <textarea
        {...props}
        id={id}
        ref={textareaRef}
        rows={rows}
        spellCheck={false}
        value={isControlled ? value : undefined}
        defaultValue={isControlled ? undefined : defaultValue}
        onChange={handleChange}
        onScroll={syncScroll}
        style={SHARED_TEXT_TAB_SIZE}
        className={cn(
          "relative block w-full resize-y overflow-auto rounded-lg border-2 border-ctp-crust bg-transparent text-transparent caret-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base",
          SHARED_TEXT_STYLE,
        )}
      />
    </div>
  );
}
