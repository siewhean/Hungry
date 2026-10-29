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
  /**
   * Visitors needed in EACH arm before the result may be read (95% confidence, 80% power for
   * the effect in the hypothesis). Do not call a winner before every arm reaches it.
   */
  minSamplePerArm?: number;
  /**
   * A staged release, not a test: the fallback is the arm every user gets until a PostHog flag
   * of this key says otherwise, so it has no flag to create before it is live.
   */
  rollout?: true;
}

export const EXPERIMENTS = {
  /**
   * Concluded without data: the card was mounted only in the archived social feed and the
   * fallback was "test". Replaced by welcome_back_v2 on the Home that ships.
   */
  welcome_back_v1: {
    variants: ["control", "test"],
    fallback: "test",
    status: "concluded",
    surface: "home",
    hypothesis:
      "Showing returning users their saved dishes and what is new at followed stalls brings more of them back to a dish page.",
    primaryMetric: "welcome_back_opened",
    guardrailMetrics: ["welcome_back_dismissed", "dish_viewed"],
  },
  /**
   * Welcome back card on the shipped Home (DiscoverHomeScreen) after more than a week away.
   * Read in WelcomeBackCard only for returning users while Home is focused and has content.
   */
  welcome_back_v2: {
    variants: ["control", "test"],
    fallback: "control",
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
   * The taste quiz options: a swipeable carousel (control) or all three options side by side
   * with tap-to-answer and auto-advance (test). Read on the taste route during onboarding only.
   * Draft until the PostHog flags exist; the fallback is the test layout, which is the fix for
   * R4-ONB-5 (browsing the carousel looked like answering). Never overlaps another test on the
   * quiz screen: run quiz_length only after this one concludes.
   */
  onboarding_quiz_layout_v1: {
    variants: ["control", "test"],
    fallback: "test",
    status: "draft",
    surface: "onboarding",
    hypothesis:
      "Seeing all three answers at once and tapping one gets more new users through the taste quiz than swiping a carousel.",
    primaryMetric: "taste_quiz_completed",
    guardrailMetrics: ["onboarding_step_skipped", "onboarding_completed"],
  },
  /**
   * Six taste questions (control) or the three that move recommendations most: spicy, sweet,
   * rich (test). Read on the taste route during onboarding only.
   */
  onboarding_quiz_length_v1: {
    variants: ["control", "test"],
    fallback: "control",
    status: "draft",
    surface: "onboarding",
    hypothesis:
      "A three-question taste quiz raises onboarding completion without making the first picks worse.",
    primaryMetric: "onboarding_completed",
    guardrailMetrics: ["onboarding_step_skipped", "dish_viewed", "dish_favourited"],
  },
  /**
   * The first-picks screen: four plain dish cards (control) or six cards with stall, price and
   * distance and a read-only preview before sign-up (test). Exposed on the result screen for a
   * signed-out user. Draft until the flags exist; the fallback is the test design (R4-ONB-1).
   */
  onboarding_result_payoff_v1: {
    variants: ["control", "test"],
    fallback: "test",
    status: "draft",
    surface: "onboarding",
    hypothesis:
      "A fuller first-picks screen that shows where each dish is, what it costs and how far it is makes more new users create the account that keeps those picks.",
    primaryMetric: "sign_up_completed",
    guardrailMetrics: ["dish_favourited", "onboarding_picks_shown", "auth_failed"],
  },
  /**
   * The location primer: the three benefit cards (control) or two compact rows that fit above
   * the buttons on a small phone (test). Exposed on the Location step.
   */
  onboarding_location_primer_v1: {
    variants: ["control", "test"],
    fallback: "test",
    status: "draft",
    surface: "onboarding",
    hypothesis:
      "A short primer that fits on one screen, with the buttons in view, raises the share of users who allow location.",
    primaryMetric: "location_permission_result",
    guardrailMetrics: ["onboarding_area_picker_viewed", "onboarding_step_skipped"],
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
   * Search results: "halal laksa under $5" is read as the Halal and Under S$5 filters plus the
   * text "laksa" (test) or sent as plain text (control). Read in the results grid only for a
   * query of 2+ words that the parser changes. Draft until the PostHog flag exists; the
   * fallback is the parsed reading, which ships to everyone first. A chip the user removes
   * (search_parse_removed) means the reading was wrong.
   */
  search_query_parsing_v1: {
    variants: ["control", "parsed"],
    fallback: "parsed",
    status: "draft",
    surface: "search",
    hypothesis:
      "Reading diet and price words in a typed search as filters gives fewer zero-result searches and more result opens for multi-word queries than sending every word as text.",
    primaryMetric: "search_result_opened",
    guardrailMetrics: ["search_zero_results", "search_parse_removed", "search_query"],
    minSamplePerArm: 1300,
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
   * Saved > Dishes list: large photo cards (control) or compact rows, about five to a screen.
   * Read in SavedDishes once the dish list has loaded. Draft until the PostHog flag exists.
   */
  saved_card_density_v1: {
    variants: ["control", "compact_rows"],
    fallback: "control",
    status: "draft",
    surface: "saved-lists",
    hypothesis:
      "Compact rows, about five to a screen, get more saved dishes opened per Saved visit than large photo cards.",
    primaryMetric: "saved_item_opened",
    guardrailMetrics: ["dish_unfavourited", "saved_directions_opened"],
    minSamplePerArm: 1500,
  },
  /**
   * The sort Saved opens on: Recent (control) or Nearest. Eligible only when the device
   * position is known. Draft until the PostHog flag exists.
   */
  saved_default_sort_v1: {
    variants: ["control", "nearest"],
    fallback: "control",
    status: "draft",
    surface: "saved-lists",
    hypothesis:
      "Opening Saved on the nearest dishes turns more saves into visits than opening on the newest saves.",
    primaryMetric: "saved_directions_opened",
    guardrailMetrics: ["saved_item_opened", "dish_unfavourited"],
    minSamplePerArm: 1500,
  },
  /**
   * Removing a saved dish: a plain toast (control) or a toast with Undo for five seconds. Draft
   * until the PostHog flag exists; the fallback is the Undo design so it ships to everyone first.
   * Measure re-saves of the same dish_id within 10 minutes of dish_unfavourited.
   */
  saved_remove_undo_v1: {
    variants: ["control", "undo_toast"],
    fallback: "undo_toast",
    status: "draft",
    surface: "saved-lists",
    hypothesis:
      "A five-second Undo on the remove toast cuts accidental removals, measured as re-saves of the same dish soon after a remove.",
    primaryMetric: "dish_favourited",
    guardrailMetrics: ["dish_unfavourited", "saved_undo_used"],
    minSamplePerArm: 1500,
  },
  /**
   * Dining preferences on Settings start open instead of folded. Measure dietary_preferences_set
   * with surface = "settings": the Settings rows tag it, and a profile edit sends it only when
   * the flags changed. Draft until the PostHog flag exists.
   */
  settings_dining_unfolded_v1: {
    variants: ["control", "unfolded"],
    fallback: "control",
    status: "draft",
    surface: "settings",
    hypothesis:
      "Showing the dining rows open instead of behind a folded header leads more Settings visitors to update their dietary and budget preferences, which makes Home and Decide for me more relevant.",
    primaryMetric: "dietary_preferences_set",
    guardrailMetrics: ["budget_preference_set", "decide_for_me_triggered", "sign_out"],
  },
  /**
   * New-password field on SignUp: masked (control) or shown as typed, with Hide. Screen-reader
   * users are not exposed. Measure sign_up_submitted filtered to screen = "sign_up":
   * sign_up_completed also counts OnboardingAuth sign-ups, where this variant is not shown.
   * Draft until weekly SignUp views are known (most accounts are made on OnboardingAuth).
   */
  auth_signup_password_visible_v1: {
    variants: ["control", "visible_password"],
    fallback: "control",
    status: "draft",
    surface: "auth",
    hypothesis:
      "Showing the new password as it is typed (with a Hide button) cuts typos and weak-password retries on Create account, so more people who open SignUp submit the form.",
    primaryMetric: "sign_up_submitted",
    guardrailMetrics: ["sign_up_completed", "auth_failed", "password_reset_requested"],
    minSamplePerArm: 390,
  },
  /**
   * Email code (no password) as the way in on Login, Create account and the onboarding account
   * step. sh chose it as the default (2026-10-27), so this is a staged release: with no PostHog
   * flag everyone gets "email_code"; a flag of this key set to "control" for a share of users
   * keeps them on the password form (also the way back if the code email misbehaves).
   * Measure sign_up_completed and sign_in_completed against auth_screen_viewed per arm.
   */
  auth_email_code_first_v1: {
    variants: ["control", "email_code"],
    fallback: "email_code",
    status: "running",
    surface: "auth",
    hypothesis:
      "Removing the password (one email field, then the 8-digit code) raises completed sign-ups and sign-ins compared with the password form, without more failed attempts or more auth emails per person.",
    primaryMetric: "sign_up_completed",
    guardrailMetrics: [
      "sign_in_completed",
      "auth_failed",
      "email_code_requested",
      "auth_screen_viewed",
    ],
    minSamplePerArm: 390,
    rollout: true,
  },
  /**
   * Ask for the name before the first review instead of at sign-up. Defined, not wired: the
   * prompt before a first review does not exist yet, so nothing reads this key. Run it after
   * auth_email_code_first_v1 settles, never together (same form).
   */
  auth_signup_name_later_v1: {
    variants: ["control", "name_later"],
    fallback: "control",
    status: "draft",
    surface: "auth",
    hypothesis:
      "Two fields instead of three (no name until the first review) raise the share of people who submit Create account.",
    primaryMetric: "sign_up_submitted",
    guardrailMetrics: ["sign_up_completed", "review_submitted", "auth_failed"],
    minSamplePerArm: 390,
  },
  /**
   * After a wrong password the error banner offers "Reset password" with the email filled.
   * Read in LoginScreen only once a wrong-password error is on screen.
   */
  auth_login_reset_nudge_v1: {
    variants: ["control", "nudge"],
    fallback: "control",
    status: "draft",
    surface: "auth",
    hypothesis:
      "Offering Reset password right in the wrong-password message means fewer people give up after a failed sign-in; measure sign_in_completed within 15 minutes of auth_failed with reason invalid_credentials.",
    primaryMetric: "sign_in_completed",
    guardrailMetrics: ["password_reset_requested", "auth_failed"],
    minSamplePerArm: 390,
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
  /**
   * "Favourite dishes" row on your own profile: up to four pinned dishes, shown (test) or left
   * out (control). Read in ProfileHomeScreen once the pins have loaded on a backend that stores
   * them, for a signed-in diner with a pinned, saved or reviewed dish. Draft until the PostHog
   * flag exists and the pins table is on production; the fallback is "test" so the row ships.
   */
  profile_favourites_showcase_v1: {
    variants: ["control", "test"],
    fallback: "test",
    status: "draft",
    surface: "profile",
    hypothesis:
      "A pinned top-four dishes row makes a profile more worth sharing, so more diners with a saved or reviewed dish share their profile.",
    primaryMetric: "profile_shared",
    guardrailMetrics: ["dish_favourited", "profile_viewed", "profile_item_opened"],
  },
  /** Decide for Me quiz length; read in DecideForMeQuizScreen, which only Discover's Decide button opens. */
  decide_quiz_v1: {
    variants: ["control", "two_questions"],
    fallback: "control",
    status: "draft", // Until search_dishes returns cuisine data (MAP-3 follow-up migration).
    surface: "decide",
    hypothesis:
      "Two questions (cuisine and price) instead of four get more diners to a pick they act on, because fewer people abandon the quiz. Only price is filtered on the server today; cuisine is matched on the client. Abandonment is decide_quiz_completed against exposures.",
    primaryMetric: "directions_opened",
    guardrailMetrics: [
      "decide_quiz_completed",
      "decide_for_me_result_shown",
      "decide_for_me_no_match",
      "decide_for_me_radius_expanded",
    ],
  },
  /**
   * Where Decide for Me's first search looks. Read in DecideForMeResultScreen. Draft until Decide
   * has about 200 users a week; the shipped fallback is the wider 1 km ring.
   */
  decide_initial_radius_v1: {
    variants: ["control", "one_km"],
    fallback: "one_km",
    status: "draft",
    surface: "decide",
    hypothesis:
      "A first search within 1 km instead of 500 m cuts no-match results and left-out quiz answers without making the pick too far to walk to.",
    primaryMetric: "decide_for_me_result_shown",
    guardrailMetrics: ["directions_opened", "decide_for_me_no_match", "decide_reroll"],
    minSamplePerArm: 1500,
  },
  /**
   * Map cards with rating, open state and the matched dish against the plain card. Read in
   * HomeMapScreen. Draft until the map has enough weekly users; the shipped fallback is rich.
   */
  map_card_rich_v1: {
    variants: ["control", "rich"],
    fallback: "rich",
    status: "draft",
    surface: "map",
    hypothesis:
      "A card that shows its rating, whether the stall is open and the dish that matched the search lifts card opens, because diners can judge a stall without leaving the map.",
    primaryMetric: "map_card_opened",
    guardrailMetrics: ["map_opened", "stall_viewed"],
    minSamplePerArm: 1500,
  },
  /** Which sheet the map opens on. Read in HomeMapScreen. Draft; the shipped fallback is cards. */
  map_default_sheet_v1: {
    variants: ["control", "list"],
    fallback: "control",
    status: "draft",
    surface: "map",
    hypothesis:
      "Opening the map on the list shows more stalls at once and gets more stall opens than the card carousel.",
    primaryMetric: "map_card_opened",
    guardrailMetrics: ["map_pin_tapped", "map_opened"],
    minSamplePerArm: 1500,
  },
  /** A new wheel starting with four nearby open stalls. Read in WheelLobbyScreen. Draft. */
  wheel_prefill_v1: {
    variants: ["control", "prefilled"],
    fallback: "prefilled",
    status: "draft",
    surface: "wheel",
    hypothesis:
      "A wheel that starts with four nearby open stalls gets more people to a spin than an empty one they have to fill by hand.",
    primaryMetric: "wheel_spun",
    guardrailMetrics: ["wheel_result_viewed", "wheel_option_added"],
    minSamplePerArm: 1500,
  },
  /**
   * Merchant Home: the newest unreplied review inline with a Reply button, instead of the
   * "Unreplied reviews" count card. Read in MerchantDashboardScreen only while the Dashboard is
   * focused, loaded and has unreplied reviews. Draft until the Merchant Centre ships to production.
   */
  merchant_inline_reply_v1: {
    variants: ["control", "inline"],
    fallback: "control",
    status: "draft",
    surface: "merchant",
    hypothesis:
      "Showing the newest unreplied review with a Reply button on the merchant Home raises how many merchants reply, as Google Business Profile's review prompt does.",
    primaryMetric: "merchant_customer_reply_sent",
    guardrailMetrics: [
      "merchant_customer_interaction_reported",
      "merchant_customer_reply_removed",
      "merchant_customer_inbox_viewed",
    ],
  },
  /**
   * "Dishes near you" in the diner's palate order with a reason line (taste), or in photo and
   * feed order (control). Read in DiscoverHomeScreen only while Home is focused, the rail has
   * six or more dishes and the diner has a palate, so an empty rail or a diner with nothing to
   * rank by never dilutes the result. Read it only in areas with menus. Draft until launch:
   * the fallback is the new taste order.
   */
  home_taste_rank_v1: {
    variants: ["control", "taste"],
    fallback: "taste",
    status: "draft",
    surface: "home",
    hypothesis:
      "A palate-ranked Dishes near you rail with a reason, leading the page, gets more dish opens per Home view than the rail in distance order, below Most reviewed.",
    primaryMetric: "discover_card_opened",
    guardrailMetrics: ["dish_viewed", "decide_for_me_triggered"],
    minSamplePerArm: 1600,
  },
  /**
   * Stalls whose menus are not in yet: folded into one "More stalls nearby" row (grouped) or
   * listed flat with "Menu coming soon" on each (control). Read in DiscoverHomeScreen while
   * Home is focused and the nearby list holds at least one stall without a menu. Draft until
   * launch: the fallback is the grouped list.
   */
  home_cold_start_v1: {
    variants: ["control", "grouped"],
    fallback: "grouped",
    status: "draft",
    surface: "home",
    hypothesis:
      "Folding menu-less stalls under the stalls that have menus raises the share of stall opens that reach a menu.",
    primaryMetric: "stall_viewed",
    guardrailMetrics: ["discover_card_opened", "home_cold_start_group_opened"],
    minSamplePerArm: 1600,
  },
  /**
   * Where the Hawker classics tiles sit on Home: below the first dish section ("compact", so a
   * dish is on the first screen) or above it ("control"). Read in DiscoverHomeScreen only while
   * Home is focused with content and a dish section to put them under, so a cold-start Home
   * (no dishes) never counts. Draft until launch: the fallback is the compact layout.
   */
  home_above_fold_v1: {
    variants: ["control", "compact"],
    fallback: "compact",
    status: "draft",
    surface: "home",
    hypothesis:
      "Putting dishes above the classics tiles raises the share of Home visits that open a dish or stall within 60 seconds.",
    primaryMetric: "discover_card_opened",
    guardrailMetrics: ["discover_search_opened", "decide_for_me_triggered"],
    minSamplePerArm: 1600,
  },
  /**
   * Reply composer: three tone chips (Thank, Apologise, Invite back) that fill an editable
   * starting reply, against the empty composer. Read in ReplyComposer when it opens on a review
   * that has no reply yet. Draft until the Merchant Centre ships to production.
   */
  merchant_reply_suggestions_v1: {
    variants: ["control", "chips"],
    fallback: "control",
    status: "draft",
    surface: "merchant",
    hypothesis:
      "Suggested starting replies raise how many reviews get a reply and shorten the time to reply, as Google Business Profile's suggested replies do.",
    primaryMetric: "merchant_customer_reply_sent",
    guardrailMetrics: [
      "merchant_customer_reply_removed",
      "merchant_reply_suggestion_used",
      "merchant_customer_interaction_reported",
    ],
    minSamplePerArm: 400,
  },
  /**
   * A "Get your stall ready" checklist on the Verification Centre for an unverified outlet
   * (verify, five dishes, hours, a photo), against the plain verification landing. Read in
   * VerificationCentreScreen only while the outlet is not verified. Draft until the Merchant
   * Centre ships to production.
   */
  merchant_setup_checklist_v1: {
    variants: ["control", "checklist"],
    fallback: "control",
    status: "draft",
    surface: "merchant",
    hypothesis:
      "A progress checklist gets more new merchants to a verified stall with at least five dishes than the verification landing alone, as Shopify's setup guide does for new sellers.",
    primaryMetric: "merchant_verification_submitted",
    guardrailMetrics: ["merchant_dish_created", "merchant_mode_opened"],
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
  if (experimentsKilled()) return definition.fallback as ExperimentVariant<K>;

  // QA can preview any variant, drafts included, before a flag exists.
  const override = overridesAllowed() ? overrides.get(key) : undefined;
  if (override) return resolveExperimentVariant(key, override);

  if (definition.status !== "running") return definition.fallback as ExperimentVariant<K>;

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
 * fallback and records no exposure. Pass `expose: false` on a later screen of
 * a test whose exposure fired earlier: it follows flag loads without exposing.
 */
export function useExperimentVariant<K extends ExperimentKey>(
  key: K,
  options: { enabled?: boolean; expose?: boolean } = {},
): ExperimentVariant<K> {
  const enabled = options.enabled ?? true;
  const expose = options.expose ?? true;
  const [variant, setVariant] = useState(() =>
    enabled ? getExperimentVariant(key, { expose }) : getFallbackVariant(key),
  );
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (!enabled) {
      setVariant(getFallbackVariant(key));
      return;
    }
    setVariant(getExperimentVariant(key, { expose }));
    const source = getFlagSource();
    if (!source) return;
    return source.onChange(() => setVariant(getExperimentVariant(keyRef.current, { expose })));
  }, [enabled, expose, key]);

  return variant;
}

function getFallbackVariant<K extends ExperimentKey>(key: K): ExperimentVariant<K> {
  return (EXPERIMENTS[key] as ExperimentDefinition).fallback as ExperimentVariant<K>;
}

/**
 * True once this key's variant is final for the session: flags have loaded (or there is no
 * flag source), or the experiment is not running, overridden, killed or already frozen. A
 * surface that picks what to fetch by arm waits for this, so a late flag load cannot swap the
 * arm after the first list is on screen.
 */
export function isExperimentAssignmentReady(key: ExperimentKey): boolean {
  if (experimentsKilled()) return true;
  if (overridesAllowed() && overrides.get(key)) return true;
  if ((EXPERIMENTS[key] as ExperimentDefinition).status !== "running") return true;
  if (sessionVariants.has(key)) return true;
  const source = getFlagSource();
  return !source || source.hasLoaded();
}

/** Calls back when flags load or reload; returns an unsubscribe. */
export function onExperimentFlagsChange(callback: () => void): () => void {
  const source = getFlagSource();
  return source ? source.onChange(callback) : () => undefined;
}
