/**
 * A/B tests on PostHog feature flags.
 *
 * PostHog assigns each user to a variant and keeps it stable across sessions
 * and devices once they sign in (identify merges the anonymous id).
 *
 * Exposure is the `$feature_flag_called` event PostHog experiments count. It
 * is sent only when an eligible user actually reaches the variant (the hook is
 * `enabled`) and only after flags have loaded, so users who never see the test
 * and the cold-start fallback render do not dilute the result. Once a user is
 * exposed, the variant is frozen for the rest of the app session so a flag
 * reload cannot switch the UI under them.
 *
 * Every experiment lists its variants, a fallback, a hypothesis, a primary
 * metric and guardrail metrics (all existing analytics events; PostHog adds
 * `$feature/<key>` to every event, so any event can be a goal). The fallback is
 * used when PostHog is off, has not loaded, has no flag with this key, the
 * experiment is not "running", or EXPO_PUBLIC_DISABLE_EXPERIMENTS=1 (kill
 * switch). To run a test: create a multivariate flag in PostHog with the same
 * key and variant names, then a PostHog experiment on that flag with the
 * primary and guardrail metrics listed here, and set status to "running".
 */

import { useEffect, useRef, useState } from "react";

import type { AnalyticsEventName } from "@/lib/analytics/types";

export type ExperimentStatus = "draft" | "running" | "concluded";

export interface ExperimentDefinition {
  variants: readonly [string, ...string[]];
  fallback: string;
  status: ExperimentStatus;
  /** The page group the test runs on. */
  surface: string;
  hypothesis: string;
  primaryMetric: AnalyticsEventName;
  guardrailMetrics: readonly AnalyticsEventName[];
}

export const EXPERIMENTS = {
  /** Welcome back card on Home after more than a week away. */
  welcome_back_v1: {
    variants: ["control", "test"],
    fallback: "test",
    status: "running",
    surface: "home",
    hypothesis:
      "Showing returning users their saved dishes and what is new at followed stalls brings more of them back to a dish page.",
    primaryMetric: "welcome_back_opened",
    guardrailMetrics: ["welcome_back_dismissed", "dish_viewed"],
  },
  /** "Write your first review" card under the stats on your own profile, when you have none. */
  profile_first_review_nudge_v1: {
    variants: ["control", "test"],
    fallback: "control",
    // Without a PostHog flag of this key everyone gets the fallback ("control").
    status: "running",
    surface: "profile",
    hypothesis:
      "Signed-in users with no reviews who see a 'Write your first review' card on their own profile submit a first review sooner than users who see only the empty Reviews list.",
    primaryMetric: "review_submitted",
    guardrailMetrics: ["review_abandoned", "review_submit_failed", "profile_viewed"],
  },
} as const satisfies Record<string, ExperimentDefinition>;

export type ExperimentKey = keyof typeof EXPERIMENTS;
export type ExperimentVariant<K extends ExperimentKey> =
  (typeof EXPERIMENTS)[K]["variants"][number];

/** Where flag values come from. PostHog in the app; tests swap in a fake. */
export interface ExperimentFlagSource {
  /** The assigned value without recording exposure. */
  peek(key: string): boolean | string | undefined;
  /** The assigned value, recording exposure ($feature_flag_called). */
  expose(key: string): boolean | string | undefined;
  /** True once flags have loaded from PostHog or its cache. */
  hasLoaded(): boolean;
  /** Calls back whenever flags load or reload; returns an unsubscribe. */
  onChange(callback: () => void): () => void;
}

function isPostHogEnabled() {
  return (
    process.env.EXPO_PUBLIC_DISABLE_POSTHOG !== "1" &&
    Boolean(process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim())
  );
}

function createPostHogFlagSource(): ExperimentFlagSource | null {
  if (!isPostHogEnabled()) return null;
  const sink = require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
  return {
    peek: sink.peekPostHogFeatureFlag,
    expose: sink.getPostHogFeatureFlag,
    hasLoaded: sink.havePostHogFeatureFlagsLoaded,
    onChange: sink.onPostHogFeatureFlags,
  };
}

let flagSource: ExperimentFlagSource | null | undefined;
const sessionVariants = new Map<string, string>();
const overrides = new Map<string, string>();

function getFlagSource(): ExperimentFlagSource | null {
  if (flagSource === undefined) flagSource = createPostHogFlagSource();
  return flagSource;
}

function experimentsKilled() {
  return process.env.EXPO_PUBLIC_DISABLE_EXPERIMENTS === "1";
}

function overridesAllowed() {
  return process.env.NODE_ENV !== "production";
}

/** Test seam: replaces the flag source and clears frozen session variants. */
export function setExperimentFlagSource(source: ExperimentFlagSource | null | undefined): void {
  flagSource = source;
  sessionVariants.clear();
}

/** Clears frozen session variants (sign-out gives PostHog a new anonymous id). */
export function resetExperimentSession(): void {
  sessionVariants.clear();
}

export function clearExperimentOverrides(): void {
  overrides.clear();
}

/**
 * QA override for a variant on this device (dev and preview builds only;
 * ignored in production). Pass null to clear.
 */
export function setExperimentOverride<K extends ExperimentKey>(
  key: K,
  variant: ExperimentVariant<K> | null,
): void {
  if (variant === null) overrides.delete(key);
  else if (overridesAllowed()) overrides.set(key, variant);
}

/** Maps a raw flag value to a known variant: true is "test", false is "control". */
export function resolveExperimentVariant<K extends ExperimentKey>(
  key: K,
  flagValue: boolean | string | undefined,
): ExperimentVariant<K> {
  const { variants, fallback } = EXPERIMENTS[key] as ExperimentDefinition;
  const value = flagValue === true ? "test" : flagValue === false ? "control" : flagValue;
  return (
    typeof value === "string" && (variants as readonly string[]).includes(value) ? value : fallback
  ) as ExperimentVariant<K>;
}

/**
 * The variant for this user. With `expose`, records exposure once flags have
 * loaded and freezes the variant for the session.
 */
export function getExperimentVariant<K extends ExperimentKey>(
  key: K,
  options: { expose?: boolean } = {},
): ExperimentVariant<K> {
  const definition = EXPERIMENTS[key] as ExperimentDefinition;
  if (experimentsKilled() || definition.status !== "running") {
    return definition.fallback as ExperimentVariant<K>;
  }

  const override = overridesAllowed() ? overrides.get(key) : undefined;
  if (override) return resolveExperimentVariant(key, override);

  const frozen = sessionVariants.get(key);
  if (frozen) return frozen as ExperimentVariant<K>;

  const source = getFlagSource();
  if (!source) return definition.fallback as ExperimentVariant<K>;

  if (!options.expose || !source.hasLoaded()) {
    return resolveExperimentVariant(key, source.peek(key));
  }

  const variant = resolveExperimentVariant(key, source.expose(key));
  sessionVariants.set(key, variant);
  return variant;
}

/**
 * The variant for this user, updated when PostHog flags load. Pass
 * `enabled: false` while the user is not eligible: the hook then returns the
 * fallback and records no exposure.
 */
export function useExperimentVariant<K extends ExperimentKey>(
  key: K,
  options: { enabled?: boolean } = {},
): ExperimentVariant<K> {
  const enabled = options.enabled ?? true;
  const [variant, setVariant] = useState(() =>
    enabled ? getExperimentVariant(key, { expose: true }) : getFallbackVariant(key),
  );
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (!enabled) {
      setVariant(getFallbackVariant(key));
      return;
    }
    setVariant(getExperimentVariant(key, { expose: true }));
    const source = getFlagSource();
    if (!source) return;
    return source.onChange(() => setVariant(getExperimentVariant(keyRef.current, { expose: true })));
  }, [enabled, key]);

  return variant;
}

function getFallbackVariant<K extends ExperimentKey>(key: K): ExperimentVariant<K> {
  return (EXPERIMENTS[key] as ExperimentDefinition).fallback as ExperimentVariant<K>;
}
