"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import GroupPicker from "@/components/group-picker";
import Input from "@/components/input";
import Select from "@/components/select";
import {
  type ApiErrorBody,
  DESCRIPTION_MAX_LENGTH,
  type Draft,
  MIN_STARSHIP_VERSION_PATTERN,
  type PublishResult,
  parseDependencies,
} from "@/lib/draft-shared";
import { apiFetch, jsonRequest } from "@/lib/drafts-client";
import type { ThemeGroup } from "@/lib/theme-groups";
import { finishSlugInput, generateSlug } from "@/lib/theme-slug";
import { useThemeSlugAvailability } from "@/lib/use-theme-slug-availability";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning";
import { VERSION_PATTERN } from "@/lib/versions";
import ConfigStep from "./config-step";
import {
  DraftStatusLine,
  ErrorBox,
  errorField,
  GoneBanner,
  Muted,
  ReviewRow,
  WizardNav,
} from "./parts";
import ScreenshotStep from "./screenshot-step";
import SlugField from "./slug-field";
import Stepper, {
  resolveStepStatus,
  type StepStatus,
  type WizardStep,
} from "./stepper";

type ColorMode = NonNullable<Draft["colorMode"]>;

// Everything the wizard edits, as the form holds it (one dependency per line,
// "" for unset). The draft on the server is the saved copy of this.
interface ThemeFields {
  name: string;
  slug: string;
  description: string;
  dependencies: string;
  minStarshipVersion: string;
  config: string;
  colorMode: ColorMode;
  colorSchemeId: string;
  group: string;
  version: string;
}

type FieldKey = keyof ThemeFields;

const FIELD_KEYS: FieldKey[] = [
  "name",
  "slug",
  "description",
  "dependencies",
  "minStarshipVersion",
  "config",
  "colorMode",
  "colorSchemeId",
  "group",
  "version",
];

const EMPTY_FIELDS: ThemeFields = {
  name: "",
  slug: "",
  description: "",
  dependencies: "",
  minStarshipVersion: "",
  config: "",
  colorMode: "dark",
  colorSchemeId: "",
  group: "",
  version: "1.0",
};

const STEPS: WizardStep[] = [
  { id: "basics", label: "Basics" },
  { id: "config", label: "Config" },
  { id: "screenshot", label: "Screenshot" },
  { id: "details", label: "Details", optional: true },
  { id: "review", label: "Review" },
];

const STEP = {
  basics: 0,
  config: 1,
  screenshot: 2,
  details: 3,
  review: 4,
} as const;

// Which step holds each field, to mark the step a failed save was about.
const FIELD_STEP: Record<string, string> = {
  name: "basics",
  slug: "basics",
  description: "basics",
  dependencies: "basics",
  minStarshipVersion: "basics",
  config: "config",
  screenshot: "screenshot",
  colorMode: "details",
  colorSchemeId: "details",
  group: "details",
  version: "details",
  versionNotes: "details",
};

const COLOR_MODE_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "both", label: "Dark & Light" },
];

const CONFIG_PLACEHOLDER = `[character]
success_symbol = '[➜](bold green)'
error_symbol = '[✗](bold red)'

[directory]
style = "blue"
truncation_length = 3
...`;

function fieldsFromDraft(draft: Draft): ThemeFields {
  return {
    name: draft.name ?? "",
    slug: draft.slug ?? "",
    description: draft.description ?? "",
    dependencies: draft.dependencies.join("\n"),
    minStarshipVersion: draft.minStarshipVersion ?? "",
    config: draft.config ?? "",
    // Unset falls back to dark at publish, so that is what the select shows.
    colorMode: draft.colorMode ?? "dark",
    colorSchemeId: draft.colorSchemeId ?? "",
    group: draft.group ?? "",
    version: draft.version ?? "1.0",
  };
}

// What counts as a change mirrors the server's own normalisation, so a
// trailing space or a blank dependency line never triggers a save.
function comparable(fields: ThemeFields, key: FieldKey): string {
  switch (key) {
    case "dependencies":
      return parseDependencies(fields.dependencies).join("\n");
    case "name":
    case "group":
    case "minStarshipVersion":
      return fields[key].trim();
    default:
      return fields[key];
  }
}

function toPayload(fields: ThemeFields, keys: FieldKey[]) {
  const payload: Record<string, unknown> = {};
  for (const key of keys) {
    if (key === "dependencies") {
      payload.dependencies = parseDependencies(fields.dependencies);
    } else if (key === "colorSchemeId") {
      payload.colorSchemeId = fields.colorSchemeId || null;
    } else {
      // "" is stored as null by the server.
      payload[key] = fields[key];
    }
  }
  return payload;
}

function copyField<K extends FieldKey>(
  target: ThemeFields,
  source: ThemeFields,
  key: K,
) {
  target[key] = source[key];
}

/** Resume a draft where it still needs something - or at the review. */
function initialStep(draft: Draft | null): number {
  if (!draft || draft.missing.includes("name")) {
    return STEP.basics;
  }
  if (draft.missing.includes("config")) {
    return STEP.config;
  }
  if (draft.missing.includes("screenshot")) {
    return STEP.screenshot;
  }
  return STEP.review;
}

interface ThemeWizardProps {
  author: string;
  colorSchemes: Array<{ id: string; name: string }>;
  // The author's existing theme groups, for the group picker.
  groups: ThemeGroup[];
  // An existing draft (/upload/[code]), or null for a fresh /upload.
  initialDraft: Draft | null;
}

/**
 * The upload wizard for a new theme. The first "Next" creates the draft and
 * moves the address to /upload/<code> without a reload; every step after
 * that saves only what changed. The same draft can be filled in from the
 * terminal (`stellar publish --draft <code>`), which is what the config
 * step's From CLI tab waits for.
 */
export default function ThemeWizard({
  author,
  colorSchemes,
  groups,
  initialDraft,
}: ThemeWizardProps) {
  const router = useRouter();
  const descriptionId = useId();
  const dependenciesId = useId();
  const minStarshipId = useId();
  const versionId = useId();

  const [draft, setDraft] = useState<Draft | null>(initialDraft);
  // Kept together so a server answer can be merged into both in one update.
  const [form, setForm] = useState(() => {
    const start = initialDraft ? fieldsFromDraft(initialDraft) : EMPTY_FIELDS;
    return { fields: start, saved: initialDraft ? start : null };
  });
  // The slug follows the name until edited by hand. An existing draft keeps
  // the slug it has.
  const [customSlug, setCustomSlug] = useState<string | null>(
    initialDraft?.slug ?? null,
  );
  const [step, setStep] = useState(() => initialStep(initialDraft));
  const [furthest, setFurthest] = useState(initialDraft ? STEPS.length - 1 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorBody | null>(null);
  // What the field a failed save blamed held at the time, so editing it
  // clears that error (and the red step) right away instead of on the next
  // save.
  const [errorValue, setErrorValue] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [minStarshipTouched, setMinStarshipTouched] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  // Steps the user has moved on from - from then on, something required
  // that is still missing there counts as a problem.
  const [leftSteps, setLeftSteps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const { fields, saved } = form;
  const slug = customSlug ?? generateSlug(fields.name);
  const current: ThemeFields = { ...fields, slug: finishSlugInput(slug) };

  /** The current value of the field an API error blames, if it names one. */
  function blamedValue(failure: ApiErrorBody | null): string | null {
    const field = errorField(failure);
    return field !== null && field in current
      ? current[field as FieldKey]
      : null;
  }

  const baseline = saved ?? EMPTY_FIELDS;
  const dirtyKeys = FIELD_KEYS.filter(
    (key) => comparable(current, key) !== comparable(baseline, key),
  );

  // A stray Ctrl+R costs the user their pasted starship config.
  useUnsavedChangesWarning(dirtyKeys.length > 0 && !leaving);

  const slugAvailability = useThemeSlugAvailability(
    fields.name,
    current.slug,
    step === STEP.basics && !gone,
    draft?.code ?? null,
  );
  const slugBlocked =
    slugAvailability.state === "empty" ||
    slugAvailability.state === "unavailable" ||
    slugAvailability.state === "draft";

  const minStarshipInvalid =
    fields.minStarshipVersion.trim().length > 0 &&
    !MIN_STARSHIP_VERSION_PATTERN.test(fields.minStarshipVersion.trim());
  const versionInvalid = !VERSION_PATTERN.test(fields.version);

  // Step statuses for the stepper, built from the same facts that enable
  // Next and Publish below.
  const minStarshipShown = minStarshipTouched && minStarshipInvalid;
  const blamed = errorField(error);
  const errorStale =
    blamed !== null && blamed in current && blamedValue(error) !== errorValue;
  const activeError = errorStale ? null : error;
  const failedStep = FIELD_STEP[errorField(activeError) ?? ""] ?? null;
  const passed = (index: number) => leftSteps.has(index) || index < step;
  const hasName = current.name.trim().length > 0;
  const hasConfig = current.config.trim().length > 0;
  const hasScreenshot = !!draft?.screenshotUrl;
  const detailsSet =
    fields.colorMode !== "dark" ||
    fields.colorSchemeId !== "" ||
    fields.group.trim() !== "" ||
    fields.version !== "1.0";

  const basicsStatus = resolveStepStatus({
    invalid: minStarshipShown || slugBlocked || failedStep === "basics",
    complete: hasName && !!current.slug && !slugBlocked && !minStarshipInvalid,
    started:
      hasName ||
      customSlug !== null ||
      fields.description.trim() !== "" ||
      fields.dependencies.trim() !== "" ||
      fields.minStarshipVersion.trim() !== "",
    missing: !hasName,
    passed: passed(STEP.basics),
  });
  const configStatus = resolveStepStatus({
    invalid: configError !== null || failedStep === "config",
    complete: hasConfig,
    started: hasConfig,
    missing: !hasConfig,
    passed: passed(STEP.config),
  });
  const screenshotStatus = resolveStepStatus({
    invalid: screenshotError !== null || failedStep === "screenshot",
    complete: hasScreenshot,
    started: hasScreenshot,
    missing: !hasScreenshot,
    passed: passed(STEP.screenshot),
  });
  // Optional: complete once left or anything on it is set, never missing.
  const detailsStatus = resolveStepStatus({
    invalid: versionInvalid || failedStep === "details",
    complete: passed(STEP.details) || detailsSet,
    started: detailsSet,
    passed: passed(STEP.details),
  });
  const canPublish =
    basicsStatus === "complete" &&
    configStatus === "complete" &&
    screenshotStatus === "complete" &&
    detailsStatus !== "error";

  const stepStatus: Record<string, StepStatus> = {
    basics: basicsStatus,
    config: configStatus,
    screenshot: screenshotStatus,
    details: detailsStatus,
    // Green only once the whole draft could be published.
    review: canPublish ? "complete" : "empty",
  };

  function setField<K extends FieldKey>(key: K, value: ThemeFields[K]) {
    setForm((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
  }

  /**
   * Takes a draft the server answered with. Fields the user hasn't touched
   * since the last save follow the server (the CLI may have changed them);
   * fields with unsaved edits keep them - except the config when stellar-cli
   * just pushed one, which wins.
   */
  function adopt(next: Draft, { replaceConfig = false } = {}) {
    const nextSaved = fieldsFromDraft(next);
    setForm((prev) => {
      const merged = { ...prev.fields };
      for (const key of FIELD_KEYS) {
        if (key === "slug") {
          continue;
        }
        const untouched =
          prev.saved !== null &&
          comparable(prev.fields, key) === comparable(prev.saved, key);
        if (untouched || (key === "config" && replaceConfig)) {
          copyField(merged, nextSaved, key);
        }
      }
      return { fields: merged, saved: nextSaved };
    });
    setDraft(next);
  }

  function handleFailure(status: number, failure: ApiErrorBody) {
    if (status === 404 && draft) {
      setGone(true);
      return;
    }
    if (failure.code === "invalid_config") {
      setConfigError(failure.error);
      setStep(STEP.config);
      return;
    }
    setError(failure);
    setErrorValue(blamedValue(failure));
  }

  /** Creates the draft on first use, then saves whatever changed. */
  async function save(): Promise<Draft | null> {
    if (!draft) {
      const result = await apiFetch<Draft>(
        "/api/drafts",
        jsonRequest("POST", {
          kind: "theme",
          ...toPayload(current, FIELD_KEYS),
        }),
      );
      if (!result.ok) {
        handleFailure(result.status, result.error);
        return null;
      }
      adopt(result.data);
      // Not router.replace: that would remount the page and lose focus and
      // scroll for nothing - the wizard already holds everything.
      window.history.replaceState(null, "", `/upload/${result.data.code}`);
      return result.data;
    }

    if (dirtyKeys.length === 0) {
      return draft;
    }
    const result = await apiFetch<Draft>(
      `/api/drafts/${draft.code}`,
      jsonRequest("PATCH", toPayload(current, dirtyKeys)),
    );
    if (!result.ok) {
      handleFailure(result.status, result.error);
      return null;
    }
    adopt(result.data);
    return result.data;
  }

  async function go(index: number) {
    if (busy) {
      return;
    }
    setError(null);
    setConfigError(null);
    setBusy(true);
    const result = await save();
    setBusy(false);
    if (!result) {
      return;
    }
    if (index !== step) {
      setLeftSteps((previous) => new Set(previous).add(step));
    }
    setStep(index);
    setFurthest((previous) => Math.max(previous, index));
  }

  async function publish() {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    const latest = await save();
    if (!latest) {
      setBusy(false);
      return;
    }
    const result = await apiFetch<PublishResult>(
      `/api/drafts/${latest.code}/publish`,
      { method: "POST" },
    );
    if (!result.ok) {
      setBusy(false);
      handleFailure(result.status, result.error);
      return;
    }
    // Cleared before navigating, or the leave-confirmation would fire on our
    // own redirect. `busy` stays on so nothing can be clicked meanwhile.
    setLeaving(true);
    router.push(`/${result.data.author}/${result.data.slug}`);
  }

  async function startOver() {
    setError(null);
    setBusy(true);
    const result = await apiFetch<Draft>(
      "/api/drafts",
      jsonRequest("POST", { kind: "theme", ...toPayload(current, FIELD_KEYS) }),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setErrorValue(blamedValue(result.error));
      return;
    }
    setForm((prev) => ({
      fields: prev.fields,
      saved: fieldsFromDraft(result.data),
    }));
    setDraft(result.data);
    setGone(false);
    window.history.replaceState(null, "", `/upload/${result.data.code}`);
    // The old screenshot went with the old draft.
    setStep(STEP.screenshot);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    switch (step) {
      case STEP.basics:
        if (!current.name.trim()) {
          setError({ error: "Give your theme a name first." });
          return;
        }
        if (minStarshipInvalid) {
          setMinStarshipTouched(true);
          return;
        }
        if (!current.slug || slugBlocked) {
          return;
        }
        go(STEP.config);
        return;
      case STEP.details:
        if (versionInvalid) {
          return;
        }
        go(STEP.review);
        return;
      case STEP.review:
        publish();
        return;
      default:
        go(step + 1);
    }
  }

  let nextLabel = "Next";
  if (step === STEP.review) {
    nextLabel = busy ? "Publishing..." : "Publish Theme";
  }

  // The same facts the step statuses are built from.
  let nextDisabled = false;
  if (step === STEP.basics) {
    nextDisabled = slugBlocked || minStarshipShown;
  } else if (step === STEP.details) {
    nextDisabled = versionInvalid;
  } else if (step === STEP.review) {
    nextDisabled = !canPublish;
  }

  const schemeName =
    colorSchemes.find((scheme) => scheme.id === current.colorSchemeId)?.name ??
    null;
  const dependencies = parseDependencies(current.dependencies);

  let configSourceNote: React.ReactNode = null;
  if (draft?.configSource === "cli" && draft.configUpdatedAt) {
    configSourceNote = (
      <Muted>
        {" "}
        · from stellar-cli{draft.source ? ` (${draft.source})` : ""}
      </Muted>
    );
  }

  return (
    <div>
      <Stepper
        steps={STEPS}
        current={step}
        furthest={gone ? -1 : furthest}
        status={stepStatus}
        onSelect={(index) => go(index)}
      />
      {!gone && <DraftStatusLine draft={draft} />}

      {gone ? (
        <GoneBanner onStartOver={startOver} busy={busy} error={error} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {step === STEP.basics && (
            <>
              <Input
                type="text"
                label="Theme Name"
                value={fields.name}
                onChange={(e) => setField("name", e.currentTarget.value)}
                maxLength={100}
                placeholder="My Awesome Theme"
              />

              <SlugField
                slug={slug}
                isCustom={customSlug !== null}
                onCustomChange={setCustomSlug}
                availability={slugAvailability}
              />

              <div>
                <label className="flex flex-col" htmlFor={descriptionId}>
                  <span className="mb-1.5 text-sm text-ctp-text">
                    Description (optional)
                  </span>
                  <textarea
                    id={descriptionId}
                    rows={3}
                    value={fields.description}
                    onChange={(e) =>
                      setField("description", e.currentTarget.value)
                    }
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    aria-describedby={`${descriptionId}-count`}
                    className="p-2 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
                    placeholder="A brief description of your theme..."
                  />
                </label>
                <p className="text-xs text-ctp-subtext0 mt-1 flex justify-between">
                  <span>Supports markdown</span>
                  <span id={`${descriptionId}-count`}>
                    {fields.description.length}/{DESCRIPTION_MAX_LENGTH}{" "}
                    characters
                  </span>
                </p>
              </div>

              <div>
                <label className="flex flex-col" htmlFor={dependenciesId}>
                  <span className="mb-1.5 text-sm text-ctp-text">
                    Dependencies (optional)
                  </span>
                  <textarea
                    id={dependenciesId}
                    rows={3}
                    value={fields.dependencies}
                    onChange={(e) =>
                      setField("dependencies", e.currentTarget.value)
                    }
                    className="p-2 rounded-lg text-sm bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
                    placeholder={`FiraCode Nerd Font
JetBrainsMono Nerd Font`}
                  />
                </label>
                <p className="text-xs text-ctp-subtext0 mt-1">
                  One per line (usually Nerd Fonts)
                </p>
              </div>

              <div>
                <Input
                  id={minStarshipId}
                  type="text"
                  label="Minimum Starship Version (optional)"
                  value={fields.minStarshipVersion}
                  onChange={(e) =>
                    setField("minStarshipVersion", e.currentTarget.value)
                  }
                  onBlur={() => setMinStarshipTouched(true)}
                  placeholder="1.24.0"
                  aria-invalid={minStarshipTouched && minStarshipInvalid}
                  className={
                    minStarshipTouched && minStarshipInvalid
                      ? "border-ctp-red! focus:ring-ctp-red/30!"
                      : undefined
                  }
                />
                {minStarshipTouched && minStarshipInvalid && (
                  <p className="text-xs text-ctp-red mt-1">
                    Expected format: X.Y.Z (e.g. 1.24.0)
                  </p>
                )}
              </div>
            </>
          )}

          {step === STEP.config && draft && (
            <ConfigStep
              code={draft.code}
              slug={current.slug}
              config={fields.config}
              onConfigChange={(value) => setField("config", value)}
              dirty={dirtyKeys.includes("config")}
              configSource={draft.configSource}
              configUpdatedAt={draft.configUpdatedAt}
              onReceived={(next) => adopt(next, { replaceConfig: true })}
              onNotFound={() => setGone(true)}
              error={configError}
              pasteLabel="Paste"
              placeholder={CONFIG_PLACEHOLDER}
            />
          )}

          {step === STEP.screenshot && draft && (
            <ScreenshotStep
              draft={draft}
              onDraft={(next) => adopt(next)}
              onGone={() => setGone(true)}
              error={screenshotError}
              onError={setScreenshotError}
            />
          )}

          {step === STEP.details && (
            <>
              <Select
                label="Theme Mode"
                value={fields.colorMode}
                onChange={(value) => setField("colorMode", value as ColorMode)}
                options={COLOR_MODE_OPTIONS}
              />

              <Select
                label="Color Scheme (optional)"
                value={fields.colorSchemeId}
                onChange={(value) => setField("colorSchemeId", value)}
                options={[
                  { value: "", label: "None" },
                  ...colorSchemes.map((scheme) => ({
                    value: scheme.id,
                    label: scheme.name,
                  })),
                ]}
              />

              <GroupPicker
                groups={groups}
                value={fields.group}
                onChange={(value) => setField("group", value)}
              />

              <div>
                <Input
                  id={versionId}
                  type="text"
                  label="First Version"
                  value={fields.version}
                  onChange={(e) => setField("version", e.currentTarget.value)}
                  placeholder="1.0"
                  aria-invalid={versionInvalid}
                  className={
                    versionInvalid
                      ? "border-ctp-red! focus:ring-ctp-red/30!"
                      : undefined
                  }
                />
                <p
                  className={`text-xs mt-1 ${versionInvalid ? "text-ctp-red" : "text-ctp-subtext0"}`}
                >
                  Two numbers like 1.0 - keep the default unless you're bringing
                  over a theme that already has versions.
                </p>
              </div>
            </>
          )}

          {step === STEP.review && (
            <>
              <dl className="rounded-lg border-2 border-ctp-crust bg-ctp-mantle px-4">
                <ReviewRow
                  label="Name"
                  missing={!current.name.trim()}
                  onEdit={() => go(STEP.basics)}
                >
                  {current.name}
                </ReviewRow>
                <ReviewRow label="Address" onEdit={() => go(STEP.basics)}>
                  <span className="font-mono">
                    /{author}/{current.slug}
                  </span>
                </ReviewRow>
                <ReviewRow label="Description" onEdit={() => go(STEP.basics)}>
                  {current.description ? (
                    <span className="line-clamp-3">{current.description}</span>
                  ) : (
                    <Muted>None</Muted>
                  )}
                </ReviewRow>
                <ReviewRow
                  label="Config"
                  missing={!current.config.trim()}
                  onEdit={() => go(STEP.config)}
                >
                  {current.config.split("\n").length} lines
                  {configSourceNote}
                </ReviewRow>
                <ReviewRow
                  label="Screenshot"
                  missing={!draft?.screenshotUrl}
                  onEdit={() => go(STEP.screenshot)}
                >
                  {draft?.screenshotUrl && (
                    <span className="relative block h-24 w-40 overflow-hidden rounded bg-ctp-surface0">
                      <Image
                        src={draft.screenshotUrl}
                        alt="Theme screenshot"
                        fill
                        unoptimized
                        className="object-cover object-top-left"
                      />
                    </span>
                  )}
                </ReviewRow>
                <ReviewRow label="Version" onEdit={() => go(STEP.details)}>
                  {current.version}
                </ReviewRow>
                <ReviewRow label="Theme Mode" onEdit={() => go(STEP.details)}>
                  {COLOR_MODE_OPTIONS.find(
                    (option) => option.value === current.colorMode,
                  )?.label ?? current.colorMode}
                </ReviewRow>
                <ReviewRow label="Color Scheme" onEdit={() => go(STEP.details)}>
                  {schemeName ?? <Muted>None</Muted>}
                </ReviewRow>
                <ReviewRow label="Group" onEdit={() => go(STEP.details)}>
                  {current.group.trim() || <Muted>None</Muted>}
                </ReviewRow>
                <ReviewRow label="Dependencies" onEdit={() => go(STEP.basics)}>
                  {dependencies.length > 0 ? (
                    dependencies.join(", ")
                  ) : (
                    <Muted>None</Muted>
                  )}
                </ReviewRow>
                <ReviewRow label="Min. Starship" onEdit={() => go(STEP.basics)}>
                  {current.minStarshipVersion.trim() || <Muted>Any</Muted>}
                </ReviewRow>
              </dl>
              <p className="text-sm text-ctp-subtext0 leading-relaxed">
                Once published, anyone can run{" "}
                <code className="text-ctp-subtext1">
                  stellar apply {author}/{current.slug}
                </code>
                . The slug can't be changed afterwards.
              </p>
            </>
          )}

          {activeError && <ErrorBox error={activeError} />}

          <WizardNav
            onBack={step > 0 ? () => go(step - 1) : null}
            nextLabel={nextLabel}
            busy={busy}
            nextDisabled={nextDisabled}
          />
        </form>
      )}
    </div>
  );
}
