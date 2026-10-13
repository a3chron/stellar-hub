"use client";

import {
  CircleCheck,
  ClipboardPaste,
  FileUp,
  Loader2,
  TerminalSquare,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import CopyButton from "@/components/docs/copy-button";
import { TimeAgo } from "@/components/local-time";
import { TomlEditor } from "@/components/toml/toml-editor";
import { CONFIG_MAX_LENGTH, type Draft } from "@/lib/draft-shared";
import { apiFetch } from "@/lib/drafts-client";
import { cn } from "@/lib/utils";

type ConfigTab = "paste" | "upload" | "cli";

// Which `stellar publish` form the From CLI tab shows.
type CommandKind = "folder" | "file";

const COMMAND_KIND_KEY = "stellar:publish-command";

const COMMAND_KINDS: Array<{ id: CommandKind; label: string }> = [
  { id: "folder", label: "Theme folder" },
  { id: "file", label: "Any .toml file" },
];

const POLL_INTERVAL_MS = 2000;

interface ConfigStepProps {
  code: string;
  // The slug `stellar publish` should be pointed at.
  slug: string;
  config: string;
  onConfigChange: (config: string) => void;
  // The local config differs from what the draft has saved.
  dirty: boolean;
  configSource: Draft["configSource"];
  configUpdatedAt: string | null;
  // A newer config arrived from stellar-cli (the full draft, config included).
  onReceived: (draft: Draft) => void;
  onNotFound: () => void;
  // The server's TOML parse error for the last save, if any.
  error: string | null;
  // "Paste", or "Latest" for a version that starts from the latest config.
  pasteLabel: string;
  placeholder?: string;
}

function isNewer(candidate: string | null, baseline: string | null) {
  if (!candidate) {
    return false;
  }
  return !baseline || Date.parse(candidate) > Date.parse(baseline);
}

/**
 * Polls the draft (without its config) every two seconds while the From CLI
 * tab is open and the page is visible, and hands over the full draft once
 * stellar-cli has pushed a config newer than the one already known.
 */
function useCliConfigPoll({
  code,
  active,
  knownUpdatedAt,
  onReceived,
  onNotFound,
}: {
  code: string;
  active: boolean;
  knownUpdatedAt: string | null;
  onReceived: (draft: Draft) => void;
  onNotFound: () => void;
}) {
  // Refs, so a new callback or a save elsewhere in the wizard doesn't tear
  // down and restart the polling loop.
  const baselineRef = useRef(knownUpdatedAt);
  const onReceivedRef = useRef(onReceived);
  const onNotFoundRef = useRef(onNotFound);
  useEffect(() => {
    baselineRef.current = knownUpdatedAt;
    onReceivedRef.current = onReceived;
    onNotFoundRef.current = onNotFound;
  });

  useEffect(() => {
    if (!active) {
      return;
    }

    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function schedule() {
      if (stopped || timer !== undefined) {
        return;
      }
      if (document.visibilityState !== "visible") {
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    async function poll() {
      timer = undefined;
      if (stopped || inFlight || document.visibilityState !== "visible") {
        return;
      }
      inFlight = true;
      try {
        const meta = await apiFetch<Draft>(`/api/drafts/${code}?config=0`);
        if (stopped) {
          return;
        }
        if (!meta.ok) {
          if (meta.status === 404) {
            stopped = true;
            onNotFoundRef.current();
          }
          return;
        }
        if (
          meta.data.configSource === "cli" &&
          isNewer(meta.data.configUpdatedAt, baselineRef.current)
        ) {
          const full = await apiFetch<Draft>(`/api/drafts/${code}`);
          if (!stopped && full.ok) {
            baselineRef.current = full.data.configUpdatedAt;
            onReceivedRef.current(full.data);
          }
        }
      } finally {
        inFlight = false;
        schedule();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        schedule();
      } else if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    }

    schedule();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [active, code]);
}

const TABS: Array<{ id: ConfigTab; icon: typeof ClipboardPaste }> = [
  { id: "paste", icon: ClipboardPaste },
  { id: "upload", icon: FileUp },
  { id: "cli", icon: TerminalSquare },
];

export default function ConfigStep({
  code,
  slug,
  config,
  onConfigChange,
  dirty,
  configSource,
  configUpdatedAt,
  onReceived,
  onNotFound,
  error,
  pasteLabel,
  placeholder,
}: ConfigStepProps) {
  const baseId = useId();
  const editorId = useId();
  const fileInputId = useId();
  const tabRefs = useRef<Partial<Record<ConfigTab, HTMLButtonElement | null>>>(
    {},
  );
  // The terminal is the usual way in, so From CLI opens first - unless the
  // config was last set right here, which is what Paste shows.
  const [tab, setTab] = useState<ConfigTab>(
    configSource === "web" ? "paste" : "cli",
  );
  const [commandKind, setCommandKind] = useState<CommandKind>("folder");

  // Remembered per browser; read after mount, since localStorage doesn't
  // exist during the server render.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COMMAND_KIND_KEY);
      if (stored === "folder" || stored === "file") {
        setCommandKind(stored);
      }
    } catch {
      // Storage blocked (private mode, disabled cookies) - keep the default.
    }
  }, []);

  function chooseCommandKind(kind: CommandKind) {
    setCommandKind(kind);
    try {
      window.localStorage.setItem(COMMAND_KIND_KEY, kind);
    } catch {
      // Not remembered then - harmless.
    }
  }
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [replacedEdits, setReplacedEdits] = useState(false);

  useCliConfigPoll({
    code,
    active: tab === "cli",
    knownUpdatedAt: configUpdatedAt,
    onReceived: (draft) => {
      // A push from the CLI wins over unsaved edits made here - say so
      // rather than silently dropping them.
      setReplacedEdits(dirty);
      onReceived(draft);
    },
    onNotFound,
  });

  const tabLabels: Record<ConfigTab, string> = {
    paste: pasteLabel,
    upload: "Upload .toml",
    cli: "From CLI",
  };

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploadError(null);
    const text = await file.text().catch(() => null);
    if (text === null) {
      setUploadError("That file couldn't be read.");
      return;
    }
    if (text.length > CONFIG_MAX_LENGTH) {
      setUploadError(
        `That file is too large - configs can be at most ${CONFIG_MAX_LENGTH} characters.`,
      );
      return;
    }

    // Same normalisation the CLI applies, so a Windows file compares equal.
    onConfigChange(text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"));
    setUploadNote(`Loaded ${file.name} - review it below.`);
    setReplacedEdits(false);
    setTab("paste");
    // The file input that had focus is in the panel that just got hidden.
    tabRefs.current.paste?.focus();
  }

  const receivedFromCli = configSource === "cli" && configUpdatedAt !== null;

  const tabId = (id: ConfigTab) => `${baseId}-tab-${id}`;
  const panelId = (id: ConfigTab) => `${baseId}-panel-${id}`;

  // WAI-ARIA tabs, as in components/docs/os-tabs.tsx: Left/Right and
  // Home/End move focus and selection together; only the selected tab is in
  // the Tab order.
  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const ids = TABS.map((entry) => entry.id);
    const currentIndex = ids.indexOf(tab);
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % ids.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + ids.length) % ids.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = ids.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = ids[nextIndex];
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="How to add the config"
        className="flex gap-1 rounded-lg border-2 border-ctp-crust bg-ctp-mantle p-1"
      >
        {TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            ref={(element) => {
              tabRefs.current[id] = element;
            }}
            type="button"
            role="tab"
            id={tabId(id)}
            aria-selected={tab === id}
            aria-controls={panelId(id)}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={handleTabKeyDown}
            className={cn(
              "flex flex-1 min-w-0 items-center justify-center gap-2 rounded-md px-2 sm:px-3 py-2 text-sm transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-lavender",
              tab === id
                ? "bg-ctp-surface0 text-ctp-text font-medium"
                : "text-ctp-subtext0 hover:text-ctp-text",
            )}
          >
            {/* Icons give way to the text on a phone, where three labels
                like "Upload .toml" barely fit. */}
            <Icon size={16} className="hidden sm:block shrink-0" />
            <span className="truncate">{tabLabels[id]}</span>
          </button>
        ))}
      </div>

      {replacedEdits && (
        <output className="flex gap-2 rounded-lg border border-ctp-peach/40 bg-ctp-peach/10 p-3 text-sm text-ctp-text">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-ctp-peach" />
          Your unsaved edits were replaced by the config stellar-cli just
          pushed.
        </output>
      )}

      <div
        role="tabpanel"
        id={panelId("paste")}
        aria-labelledby={tabId("paste")}
        hidden={tab !== "paste"}
      >
        <div>
          <label htmlFor={editorId} className="sr-only">
            Starship config (TOML)
          </label>
          <TomlEditor
            id={editorId}
            value={config}
            onChange={(value) => {
              setUploadNote(null);
              onConfigChange(value);
            }}
            rows={16}
            placeholder={placeholder}
            aria-invalid={error !== null}
          />
          <p className="text-xs text-ctp-subtext0 mt-1">
            {uploadNote ?? "Your complete starship.toml."}
          </p>
        </div>
      </div>

      <div
        role="tabpanel"
        id={panelId("upload")}
        aria-labelledby={tabId("upload")}
        hidden={tab !== "upload"}
      >
        <div className="rounded-lg border-2 border-dashed border-ctp-surface0 bg-ctp-mantle p-8 text-center">
          <FileUp className="mx-auto mb-3 h-8 w-8 text-ctp-overlay1" />
          {/* The input sits inside its label so the label can show keyboard
              focus (the input itself is visually hidden). */}
          <label
            htmlFor={fileInputId}
            className="inline-block cursor-pointer rounded-md border-2 border-ctp-surface1 bg-ctp-surface0 px-4 py-2 text-sm text-ctp-text transition hover:bg-ctp-surface1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ctp-lavender has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-ctp-base"
          >
            Choose a .toml file
            <input
              id={fileInputId}
              type="file"
              accept=".toml,text/plain,application/toml"
              onChange={handleFile}
              className="sr-only"
            />
          </label>
          <p className="mt-3 text-xs text-ctp-subtext0">
            Usually <code>~/.config/starship.toml</code>. It opens in the{" "}
            {pasteLabel} tab so you can check it first.
          </p>
          {uploadError && (
            <p role="alert" className="mt-2 text-sm text-ctp-red">
              {uploadError}
            </p>
          )}
        </div>
      </div>

      <div
        role="tabpanel"
        id={panelId("cli")}
        aria-labelledby={tabId("cli")}
        hidden={tab !== "cli"}
      >
        <div className="space-y-5">
          <ol className="space-y-4 text-sm text-ctp-subtext0 leading-relaxed">
            <li className="flex gap-3">
              <StepNumber>1</StepNumber>
              <p>
                Not logged in yet? Run{" "}
                <code className="text-ctp-subtext1">stellar auth</code> first.
              </p>
            </li>
            <li className="flex gap-3">
              <StepNumber>2</StepNumber>
              <div className="flex-1 min-w-0 space-y-2">
                <p>
                  Run this in your terminal - this page updates as soon as the
                  config arrives.
                </p>
                <fieldset className="inline-flex gap-1 rounded-lg border-2 border-ctp-crust bg-ctp-mantle p-1">
                  <legend className="sr-only">Publish from</legend>
                  {COMMAND_KINDS.map((kind) => (
                    <button
                      key={kind.id}
                      type="button"
                      aria-pressed={commandKind === kind.id}
                      onClick={() => chooseCommandKind(kind.id)}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs transition cursor-pointer",
                        commandKind === kind.id
                          ? "bg-ctp-surface0 text-ctp-text font-medium"
                          : "text-ctp-subtext0 hover:text-ctp-text",
                      )}
                    >
                      {kind.label}
                    </button>
                  ))}
                </fieldset>
                <CommandLine
                  command={
                    commandKind === "folder"
                      ? `stellar publish ${slug} --draft ${code}`
                      : `stellar publish ./path/to/starship.toml --draft ${code}`
                  }
                />
                {commandKind === "folder" && (
                  <p className="text-xs">
                    <code className="text-ctp-subtext1">{slug}</code> stands for
                    your theme's folder name in{" "}
                    <code className="text-ctp-subtext1">~/.config/stellar</code>
                    .
                  </p>
                )}
              </div>
            </li>
          </ol>

          {receivedFromCli ? (
            <div className="space-y-2">
              <output className="flex items-center gap-2 text-sm text-ctp-green">
                <CircleCheck size={16} className="shrink-0" />
                <span>
                  Received from stellar-cli{" "}
                  <span className="text-ctp-subtext0">
                    (<TimeAgo date={configUpdatedAt} />)
                  </span>
                </span>
              </output>
              <TomlEditor
                value={config}
                readOnly
                rows={10}
                aria-label="Config received from stellar-cli"
              />
              <p className="text-xs text-ctp-subtext0">
                Run the command again to replace it, or switch to {pasteLabel}{" "}
                to tweak it here.
              </p>
            </div>
          ) : (
            <output className="flex items-center gap-2 text-sm text-ctp-subtext0">
              <Loader2 size={16} className="shrink-0 animate-spin" />
              Waiting for stellar-cli…
            </output>
          )}
        </div>
      </div>

      {error && (
        <pre
          role="alert"
          className="whitespace-pre-wrap break-words rounded-lg border-2 border-ctp-red/40 bg-ctp-mantle p-3 font-mono text-xs text-ctp-red"
        >
          {error}
        </pre>
      )}
    </div>
  );
}

function StepNumber({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ctp-surface0 text-xs font-semibold text-ctp-text"
    >
      {children}
    </span>
  );
}

function CommandLine({ command }: { command: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap rounded-lg border-2 border-ctp-crust bg-ctp-mantle px-3 py-2 font-mono text-sm text-ctp-text">
        {command}
      </code>
      <CopyButton text={command} />
    </div>
  );
}
