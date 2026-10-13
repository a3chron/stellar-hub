"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import Input from "@/components/input";
import {
  type ApiErrorBody,
  type Draft,
  MIN_STARSHIP_VERSION_PATTERN,
  type PublishResult,
  parseDependencies,
  VERSION_NOTES_MAX_LENGTH,
} from "@/lib/draft-shared";
import { apiFetch, jsonRequest } from "@/lib/drafts-client";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning";
import { cn } from "@/lib/utils";
import { calculateNextVersion, compareVersions } from "@/lib/versions";
import ConfigStep from "./config-step";
import {
  DraftStatusLine,
  ErrorBox,
  errorField,
  GoneBanner,
  Muted,
  PublishConsent,
  ReviewRow,
  StepHeading,
  useStepFocus,
  WizardNav,
} from "./parts";
import Stepper, {
  resolveStepStatus,
  type StepStatus,
  type WizardStep,
} from "./stepper";

interface VersionFields {
  config: string;
  version: string;
  versionNotes: string;
  dependencies: string;
  minStarshipVersion: string;
}

type FieldKey = keyof VersionFields;

const FIELD_KEYS: FieldKey[] = [
  "config",
  "version",
  "versionNotes",
  "dependencies",
  "minStarshipVersion",
];

const STEPS: WizardStep[] = [
  { id: "config", label: "Config" },
  { id: "version", label: "Version" },
  { id: "review", label: "Review" },
];

const STEP = { config: 0, version: 1, review: 2 } as const;

// Fields on the Version step, to mark it when a save or publish fails on one.
const VERSION_STEP_FIELDS = [
  "version",
  "versionNotes",
  "dependencies",
  "minStarshipVersion",
];

function fieldsFromDraft(draft: Draft): VersionFields {
  return {
    config: draft.config ?? "",
    version: draft.version ?? "",
    versionNotes: draft.versionNotes ?? "",
    dependencies: draft.dependencies.join("\n"),
    minStarshipVersion: draft.minStarshipVersion ?? "",
  };
}

function comparable(fields: VersionFields, key: FieldKey): string {
  if (key === "dependencies") {
    return parseDependencies(fields.dependencies).join("\n");
  }
  if (key === "minStarshipVersion") {
    return fields.minStarshipVersion.trim();
  }
  return fields[key];
}

function toPayload(fields: VersionFields, keys: FieldKey[]) {
  const payload: Record<string, unknown> = {};
  for (const key of keys) {
    payload[key] =
      key === "dependencies"
        ? parseDependencies(fields.dependencies)
        : fields[key];
  }
  return payload;
}

function copyField<K extends FieldKey>(
  target: VersionFields,
  source: VersionFields,
  key: K,
) {
  target[key] = source[key];
}

type Bump = "minor" | "patch";

/**
 * The wizard for a new version of an existing theme: the config (starting
 * from the latest version's), the version number and notes, and a review
 * that refuses to publish a version identical to the latest one.
 */
export default function VersionWizard({
  author,
  initialDraft,
}: {
  author: string;
  initialDraft: Draft;
}) {
  const router = useRouter();
  const notesId = useId();
  const minStarshipId = useId();
  const dependenciesId = useId();

  const theme = initialDraft.theme;
  const latestVersion = theme?.latestVersion ?? null;
  const bumps: Record<Bump, string> = {
    minor: calculateNextVersion(latestVersion ?? "0.0", "minor"),
    patch: calculateNextVersion(latestVersion ?? "0.0", "patch"),
  };
  // A version stellar-cli set (`--version`, or a newer local file) that isn't
  // one of the two bumps stays selectable as it is.
  const [cliVersion] = useState(() => {
    const version = initialDraft.version;
    return version && version !== bumps.minor && version !== bumps.patch
      ? version
      : null;
  });

  const [draft, setDraft] = useState<Draft>(initialDraft);
  // A draft without a version starts out on the minor bump, like the old
  // form did - in the saved copy too, so opening the wizard is no edit.
  function withDefaultVersion(fields: VersionFields): VersionFields {
    return { ...fields, version: fields.version || bumps.minor };
  }

  const [form, setForm] = useState(() => {
    const start = withDefaultVersion(fieldsFromDraft(initialDraft));
    return { fields: start, saved: start };
  });
  const [step, setStep] = useState<number>(STEP.config);
  const [furthest, setFurthest] = useState(STEPS.length - 1);
  const [busy, setBusy] = useState(false);
  const { headingRef, requestFocus } = useStepFocus();
  // The format error shows once the field is left, then follows every
  // keystroke - same as in the theme wizard.
  const [minStarshipTouched, setMinStarshipTouched] = useState(false);
  const [error, setError] = useState<ApiErrorBody | null>(null);
  // What the field a failed save blamed held at the time, so editing it
  // clears that error (and the red step) right away instead of on the next
  // save.
  const [errorValue, setErrorValue] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Steps the user has moved on from - from then on, something required
  // that is still missing there counts as a problem.
  const [leftSteps, setLeftSteps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const { fields, saved } = form;

  /** The current value of the field an API error blames, if it names one. */
  function blamedValue(failure: ApiErrorBody | null): string | null {
    const field = errorField(failure);
    return field !== null && field in fields ? fields[field as FieldKey] : null;
  }
  const dirtyKeys = FIELD_KEYS.filter(
    (key) => comparable(fields, key) !== comparable(saved, key),
  );

  useUnsavedChangesWarning(dirtyKeys.length > 0 && !leaving);

  const minStarshipInvalid =
    fields.minStarshipVersion.trim().length > 0 &&
    !MIN_STARSHIP_VERSION_PATTERN.test(fields.minStarshipVersion.trim());
  const minStarshipShown = minStarshipTouched && minStarshipInvalid;

  // A version stellar-cli set can be older than the latest one; the bumps
  // never are. Shown inline, and the publish would be refused anyway.
  const versionNotNewer =
    fields.version !== "" &&
    latestVersion !== null &&
    compareVersions(fields.version, latestVersion) <= 0;

  function setField<K extends FieldKey>(key: K, value: VersionFields[K]) {
    setForm((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
  }

  // Same merge rule as the theme wizard: untouched fields follow the server,
  // unsaved edits stay - except the config when stellar-cli pushed one.
  function adopt(next: Draft, { replaceConfig = false } = {}) {
    const nextSaved = withDefaultVersion(fieldsFromDraft(next));
    setForm((prev) => {
      const merged = { ...prev.fields };
      for (const key of FIELD_KEYS) {
        const untouched =
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
    if (status === 404) {
      setGone(true);
      return;
    }
    if (failure.code === "invalid_config") {
      setConfigError(failure.error);
      if (step !== STEP.config) {
        requestFocus();
        setStep(STEP.config);
      }
      return;
    }
    setError(failure);
    setErrorValue(blamedValue(failure));
  }

  async function save(): Promise<Draft | null> {
    // The defaulted version isn't an edit, but the server doesn't have it
    // yet - it goes along with the first save (publishing saves first).
    const keys =
      draft.version === null && !dirtyKeys.includes("version")
        ? [...dirtyKeys, "version" as const]
        : dirtyKeys;
    if (keys.length === 0) {
      return draft;
    }
    const result = await apiFetch<Draft>(
      `/api/drafts/${draft.code}`,
      jsonRequest("PATCH", toPayload(fields, keys)),
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
      requestFocus();
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
    setLeaving(true);
    router.push(`/${result.data.author}/${result.data.slug}`);
  }

  async function startOver() {
    if (!theme) {
      return;
    }
    setError(null);
    setBusy(true);
    const result = await apiFetch<Draft>(
      "/api/drafts",
      jsonRequest("POST", {
        kind: "version",
        themeSlug: theme.slug,
        ...toPayload(fields, FIELD_KEYS),
      }),
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
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (step === STEP.version) {
      if (minStarshipInvalid) {
        setMinStarshipTouched(true);
        return;
      }
      if (versionNotNewer) {
        return;
      }
    }
    if (step === STEP.review) {
      publish();
      return;
    }
    go(step + 1);
  }

  // Shown only once everything is saved - the flag is about the saved draft.
  const unchanged = draft.unchangedFromLatest && dirtyKeys.length === 0;

  // Step statuses for the stepper, built from the same facts that enable
  // Next and Publish below.
  const blamed = errorField(error);
  const errorStale =
    blamed !== null && blamed in fields && blamedValue(error) !== errorValue;
  const activeError = errorStale ? null : error;
  const failedField = errorField(activeError);
  const passed = (index: number) => leftSteps.has(index) || index < step;
  const hasConfig = fields.config.trim().length > 0;
  // Still the untouched copy of the latest version's config.
  const configIsLatest =
    draft.configSource === "latest" && !dirtyKeys.includes("config");

  const configStatus = resolveStepStatus({
    invalid: configError !== null || failedField === "config",
    complete: hasConfig && !configIsLatest,
    started: hasConfig,
    missing: !hasConfig,
    passed: passed(STEP.config),
  });
  const versionStatus = resolveStepStatus({
    invalid:
      minStarshipShown ||
      versionNotNewer ||
      VERSION_STEP_FIELDS.includes(failedField ?? ""),
    complete: fields.version !== "" && !minStarshipInvalid,
    started:
      fields.version !== "" ||
      fields.versionNotes.trim() !== "" ||
      fields.dependencies.trim() !== "" ||
      fields.minStarshipVersion.trim() !== "",
    missing: fields.version === "",
    passed: passed(STEP.version),
  });
  // A config that is still the latest one is fine to publish as long as
  // something else changed - `unchanged` is what refuses it.
  const canPublish =
    configStatus !== "error" &&
    hasConfig &&
    versionStatus === "complete" &&
    !unchanged;

  const stepStatus: Record<string, StepStatus> = {
    config: configStatus,
    version: versionStatus,
    // Green only once the whole draft could be published.
    review: canPublish ? "complete" : "empty",
  };

  let nextDisabled = false;
  if (step === STEP.version) {
    nextDisabled = minStarshipShown || versionNotNewer;
  } else if (step === STEP.review) {
    nextDisabled = !canPublish;
  }

  let nextLabel = "Next";
  if (step === STEP.review) {
    nextLabel = busy ? "Publishing..." : `Publish v${fields.version}`;
  }

  let configSourceNote = "edited here";
  if (draft.configSource === "latest") {
    configSourceNote = `same as v${latestVersion}`;
  } else if (draft.configSource === "cli") {
    configSourceNote = `from stellar-cli${draft.source ? ` (${draft.source})` : ""}`;
  }

  const dependencies = parseDependencies(fields.dependencies);
  const versionOptions: Array<{ value: string; label: string }> = [
    { value: bumps.minor, label: `Minor (${bumps.minor})` },
    { value: bumps.patch, label: `Patch (${bumps.patch})` },
  ];
  if (cliVersion) {
    versionOptions.push({
      value: cliVersion,
      label: `${cliVersion} (from stellar-cli)`,
    });
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
          <StepHeading key={step} step={STEPS[step]} headingRef={headingRef} />

          {step === STEP.config && (
            <>
              <p className="text-sm text-ctp-subtext0 leading-relaxed">
                Starts from the config of v{latestVersion}. Edit it here, upload
                a file, or push one from your terminal.
              </p>
              <ConfigStep
                code={draft.code}
                slug={theme?.slug ?? ""}
                config={fields.config}
                onConfigChange={(value) => setField("config", value)}
                dirty={dirtyKeys.includes("config")}
                configSource={draft.configSource}
                configUpdatedAt={draft.configUpdatedAt}
                onReceived={(next) => adopt(next, { replaceConfig: true })}
                onNotFound={() => setGone(true)}
                error={configError}
                pasteLabel="Edit latest"
              />
            </>
          )}

          {step === STEP.version && (
            <>
              <fieldset>
                <legend className="block text-sm text-ctp-text mb-2">
                  Version Bump
                </legend>
                <div className="flex flex-wrap gap-3">
                  {versionOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={fields.version === option.value}
                      onClick={() => setField("version", option.value)}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-md border-2 transition cursor-pointer whitespace-nowrap",
                        fields.version === option.value
                          ? "bg-ctp-text text-ctp-base border-ctp-subtext0"
                          : "bg-ctp-surface0 text-ctp-text border-ctp-surface1 hover:bg-ctp-surface1",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-ctp-subtext0 mt-2">
                  Latest is v{latestVersion}.{" "}
                  <span className="text-ctp-text">Minor:</span> New features,
                  improvements • <span className="text-ctp-text">Patch:</span>{" "}
                  Small fixes
                  <br />
                  For breaking changes, major redesigns, please create a new
                  theme
                </p>
                {versionNotNewer && (
                  <p role="alert" className="text-xs text-ctp-red mt-2">
                    v{fields.version} isn't newer than the latest v
                    {latestVersion} - pick one of the bumps instead.
                  </p>
                )}
              </fieldset>

              <div>
                <label className="flex flex-col" htmlFor={notesId}>
                  <span className="mb-1.5 text-sm text-ctp-text">
                    Version Notes (optional)
                  </span>
                  <textarea
                    id={notesId}
                    rows={3}
                    value={fields.versionNotes}
                    onChange={(e) =>
                      setField("versionNotes", e.currentTarget.value)
                    }
                    maxLength={VERSION_NOTES_MAX_LENGTH}
                    className="p-2 rounded-lg text-sm bg-ctp-mantle border-2 border-ctp-crust text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base"
                    placeholder="What's new in this version..."
                  />
                </label>
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
                  aria-invalid={minStarshipShown}
                  aria-describedby={
                    minStarshipShown ? `${minStarshipId}-error` : undefined
                  }
                  className={
                    minStarshipShown
                      ? "border-ctp-red! focus:ring-ctp-red/30!"
                      : undefined
                  }
                />
                {minStarshipShown && (
                  <p
                    id={`${minStarshipId}-error`}
                    className="text-xs text-ctp-red mt-1"
                  >
                    Expected format: X.Y.Z (e.g. 1.24.0)
                  </p>
                )}
              </div>
            </>
          )}

          {step === STEP.review && (
            <>
              <dl className="rounded-lg border-2 border-ctp-crust bg-ctp-mantle px-4">
                <ReviewRow label="Theme">
                  {theme?.name}{" "}
                  <span className="font-mono text-ctp-subtext0">
                    /{author}/{theme?.slug}
                  </span>
                </ReviewRow>
                <ReviewRow
                  label="New version"
                  missing={!fields.version}
                  onEdit={() => go(STEP.version)}
                >
                  v{fields.version} <Muted>(latest is v{latestVersion})</Muted>
                </ReviewRow>
                <ReviewRow
                  label="Config"
                  missing={!fields.config.trim()}
                  onEdit={() => go(STEP.config)}
                >
                  {fields.config.split("\n").length} lines{" "}
                  <Muted>· {configSourceNote}</Muted>
                </ReviewRow>
                <ReviewRow label="Notes" onEdit={() => go(STEP.version)}>
                  {fields.versionNotes.trim() ? (
                    <span className="line-clamp-3">{fields.versionNotes}</span>
                  ) : (
                    <Muted>None</Muted>
                  )}
                </ReviewRow>
                <ReviewRow label="Dependencies" onEdit={() => go(STEP.version)}>
                  {dependencies.length > 0 ? (
                    dependencies.join(", ")
                  ) : (
                    <Muted>None</Muted>
                  )}
                </ReviewRow>
                <ReviewRow
                  label="Min. Starship"
                  onEdit={() => go(STEP.version)}
                >
                  {fields.minStarshipVersion.trim() || <Muted>Any</Muted>}
                </ReviewRow>
              </dl>

              {unchanged && (
                <p
                  role="alert"
                  className="flex gap-2 rounded-lg border border-ctp-peach/40 bg-ctp-peach/10 p-3 text-sm text-ctp-text"
                >
                  <TriangleAlert
                    size={16}
                    className="mt-0.5 shrink-0 text-ctp-peach"
                  />
                  Nothing changed compared to v{latestVersion} - update the
                  config, dependencies or minimum Starship version first.
                </p>
              )}
              <PublishConsent />
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
