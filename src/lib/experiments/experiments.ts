/**
 * A/B tests on PostHog feature flags.
 *
 * PostHog assigns each user to a variant and keeps it stable across sessions
 * and devices once they sign in (identify merges the anonymous id). Reading a
 * flag logs `$feature_flag_called`, which PostHog experiments use as exposure.
 *
 * Every experiment lists its variants and a fallback. The fallback is used
 * when PostHog is off, has not loaded yet, or has no flag with this key, so a
 * feature ships with its fallback until a flag is created to split traffic.
 * To run a test: create a multivariate flag in PostHog with the same key and
 * variant names, then a PostHog experiment on that flag.
 */

import { useEffect, useState } from "react";

export const EXPERIMENTS = {
  /** Welcome back card on Home after more than a week away. */
  welcome_back_v1: { variants: ["control", "test"], fallback: "test" },
} as const satisfies Record<string, { variants: readonly string[]; fallback: string }>;

export type ExperimentKey = keyof typeof EXPERIMENTS;
export type ExperimentVariant<K extends ExperimentKey> =
  (typeof EXPERIMENTS)[K]["variants"][number];

function isPostHogEnabled() {
  return (
    process.env.EXPO_PUBLIC_DISABLE_POSTHOG !== "1" &&
    Boolean(process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim())
  );
}

function getPostHogSink() {
  return require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
}

/** Maps a raw flag value to a known variant: true is "test", false is "control". */
export function resolveExperimentVariant<K extends ExperimentKey>(
  key: K,
  flagValue: boolean | string | undefined,
): ExperimentVariant<K> {
  const { variants, fallback } = EXPERIMENTS[key];
  const value = flagValue === true ? "test" : flagValue === false ? "control" : flagValue;
  return (
    typeof value === "string" && (variants as readonly string[]).includes(value) ? value : fallback
  ) as ExperimentVariant<K>;
}

export function getExperimentVariant<K extends ExperimentKey>(key: K): ExperimentVariant<K> {
  const flagValue = isPostHogEnabled() ? getPostHogSink().getPostHogFeatureFlag(key) : undefined;
  return resolveExperimentVariant(key, flagValue);
}

/** The variant for this user, updated when PostHog flags load. */
export function useExperimentVariant<K extends ExperimentKey>(key: K): ExperimentVariant<K> {
  const [variant, setVariant] = useState(() => getExperimentVariant(key));

  useEffect(() => {
    if (!isPostHogEnabled()) return;
    setVariant(getExperimentVariant(key));
    return getPostHogSink().onPostHogFeatureFlags(() => setVariant(getExperimentVariant(key)));
  }, [key]);

  return variant;
}
