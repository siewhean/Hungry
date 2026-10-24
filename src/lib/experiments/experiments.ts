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
  /**
   * What follows a Tried mark on the dish page: the rate-it popup (control) or no popup and
   * the bar's call to action reading "Rate it" (toast_cta). Read in TriedFollowUp, which mounts
   * only after a Tried mark succeeds for a signed-in diner who has not reviewed the dish.
   * Analyse as a funnel from dish_marked_tried to review_submitted on the same dish_id in 24 h.
   */
  dish_tried_prompt_v1: {
    variants: ["control", "toast_cta"],
    fallback: "control",
    status: "running",
    surface: "dish",
    hypothesis:
      "A popup straight after Tried interrupts diners and teaches them to dismiss it; a quieter Rate it button converts more Tried marks into published reviews.",
    primaryMetric: "review_submitted",
    guardrailMetrics: [
      "review_abandoned",
      "review_started",
      "dish_unfavourited",
      "review_cta_tapped",
    ],
  },
  /**
   * The last onboarding step for a signed-out user. Exposure fires on the result screen
   * (the CTA is visible from first render); the account screen reads the frozen variant
   * without exposing again. On a fresh install flags may load while the user is on the
   * result screen, so the CTA can switch once; the session freeze stops any later switch.
   */
  onboarding_account_framing_v1: {
    variants: ["control", "test"],
    fallback: "control",
    status: "running",
    surface: "onboarding",
    hypothesis:
      'Telling a signed-out user that the account step saves their taste profile and the dishes they were just shown ("Save my picks") lifts sign-up completion compared with "Start exploring".',
    primaryMetric: "sign_up_completed",
    guardrailMetrics: [
      "auth_screen_viewed",
      "auth_failed",
      "dish_favourited",
      "onboarding_picks_shown",
    ],
  },
  /**
   * Search home "Dishes to Discover": island-wide top 3 by rating (control) vs the top 6 within
   * 1.5 km (near, falls back to the island-wide list under 3 nearby dishes). Draft until the
   * catalog stores a Bayesian score to rank on (SEARCH-7 follow-up migration).
   */
  search_home_featured_v1: {
    variants: ["control", "near"],
    fallback: "control",
    status: "draft",
    surface: "search",
    hypothesis:
      "Showing the best dishes within 1.5 km of the user, with distance, on Search home leads more users to open a dish from Search home than the island-wide top 3 by rating.",
    primaryMetric: "search_home_featured_opened",
    guardrailMetrics: ["dish_viewed", "review_started", "search_query", "search_zero_results"],
  },
  /**
   * Stall page sticky bar: the orange button is Directions and Review becomes an icon.
   * Read in StallInteractionBar only when the bar has both Directions and Review.
   */
  stall_bar_cta_v1: {
    variants: ["control", "directions_cta"],
    fallback: "control",
    status: "running",
    surface: "stall",
    hypothesis:
      "Most stall visitors are choosing where to go. An orange Directions button, with Review as an icon, raises Directions opens without cutting reviews by more than 10%.",
    primaryMetric: "directions_opened",
    guardrailMetrics: [
      "review_cta_tapped",
      "review_submitted",
      "stall_saved",
      "stall_marked_tried",
      "stall_menu_dish_opened",
    ],
  },
  /**
  /** "Save to list" next to Save on the catalog dish page (CatalogRawDetail). */
  catalog_save_to_list_v1: {
    variants: ["control", "save_with_lists"],
    fallback: "control",
    status: "running",
    surface: "saved-lists",
    hypothesis:
      "Offering Save to list next to Save on the dish page diners actually reach gets more of them organising saves into lists, without reducing plain saves.",
    primaryMetric: "portfolio_item_added",
    guardrailMetrics: ["dish_favourited", "dish_unfavourited", "list_item_removed", "dish_viewed"],
  },
  /**
  /** Dining preferences on Settings start open instead of folded. */
  settings_dining_unfolded_v1: {
    variants: ["control", "unfolded"],
    fallback: "control",
    status: "running",
    surface: "settings",
    hypothesis:
      "Showing the dining rows open instead of behind a folded header leads more Settings visitors to update their dietary and budget preferences, which makes Home and Decide for me more relevant.",
    primaryMetric: "dietary_preferences_set",
    guardrailMetrics: ["budget_preference_set", "decide_for_me_triggered", "sign_out"],
  },
  /**
  /** New-password field on SignUp: masked (control) or shown as typed, with Hide. */
  auth_signup_password_visible_v1: {
    variants: ["control", "visible_password"],
    fallback: "control",
    status: "running",
    surface: "auth",
    hypothesis:
      "Showing the new password as it is typed (with a Hide button) cuts typos and weak-password retries on Create account, so more people who open SignUp finish signing up.",
    primaryMetric: "sign_up_completed",
    guardrailMetrics: ["sign_up_submitted", "auth_failed", "password_reset_requested"],
  },
  /**
   * Dish name and stars on Reviews grid tiles. Control keeps photo and date only (sh, 9ae387b).
   * Exposed once a focused, non-empty live grid is on screen (ReviewFeedScreen).
   */
  review_tile_labels_v1: {
    variants: ["control", "labels"],
    fallback: "control",
    status: "running",
    surface: "reviews",
    hypothesis:
      "Showing the dish name and stars on Reviews grid tiles lets people pick what to open, so more exposed users open a review and go on to the dish.",
    primaryMetric: "review_opened",
    guardrailMetrics: [
      "dish_viewed",
      "review_feed_filter_changed",
      "review_feed_searched",
      "review_started",
    ],
  },
  /**
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
  const sink =
    require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
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
    return source.onChange(() =>
      setVariant(getExperimentVariant(keyRef.current, { expose: true })),
    );
  }, [enabled, key]);

  return variant;
}

function getFallbackVariant<K extends ExperimentKey>(key: K): ExperimentVariant<K> {
  return (EXPERIMENTS[key] as ExperimentDefinition).fallback as ExperimentVariant<K>;
}
