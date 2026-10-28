import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { OnboardingFlowScreen } from "./onboardingFlow";

/**
 * The routes of the new first-run flow, in order. `TasteQuiz` holds the six taste sliders, so the
 * 22 numbered screens in onboardingFlow.ts fit 17 routes.
 */
export const SLIDER_FLOW_ROUTES = [
  "OnboardingWelcome",
  "OnboardingName",
  "LocationPermission",
  "OnboardingAreas",
  "OnboardingMealTimes",
  "OnboardingPalateIntro",
  "TasteQuiz",
  "OnboardingPalateReveal",
  "DietaryPreferences",
  "OnboardingDishGrid",
  "OnboardingPrice",
  "FoodOpenness",
  "OnboardingSwipe",
  "OnboardingLoading",
  "OnboardingResults",
  "OnboardingMealPicks",
  "OnboardingAuth",
] as const;

export type SliderFlowRoute = (typeof SLIDER_FLOW_ROUTES)[number];

/** Today's flow (flag off): welcome, location, taste quiz, dietary, openness, result. */
const LEGACY_NEXT = {
  OnboardingWelcome: "LocationPermission",
  LocationPermission: "TasteQuiz",
  ManualLocationPicker: "TasteQuiz",
  TasteQuiz: "DietaryPreferences",
  DietaryPreferences: "FoodOpenness",
  FoodOpenness: "TasteProfileResult",
} as const;

type LegacyFrom = keyof typeof LEGACY_NEXT;
export type FlowFromRoute = LegacyFrom | SliderFlowRoute;

type NextRoute<From extends FlowFromRoute> = From extends LegacyFrom
  ? (typeof LEGACY_NEXT)[From] | SliderFlowRoute
  : SliderFlowRoute;

/**
 * The route after this one. With the slider flow off it is today's order; with it on it is the next
 * route in SLIDER_FLOW_ROUTES. The manual area picker counts as the location step.
 */
export function nextOnboardingRoute<From extends FlowFromRoute>(
  from: From,
  sliderFlow: boolean = FEATURE_FLAGS.sliderOnboardingEnabled,
): NextRoute<From> {
  if (!sliderFlow) {
    const legacy = (LEGACY_NEXT as Record<string, string | undefined>)[from];
    if (legacy) return legacy as NextRoute<From>;
  }
  const position = from === "ManualLocationPicker" ? "LocationPermission" : from;
  const index = SLIDER_FLOW_ROUTES.indexOf(position as SliderFlowRoute);
  const next = SLIDER_FLOW_ROUTES[Math.min(SLIDER_FLOW_ROUTES.length - 1, index + 1)]!;
  return next as NextRoute<From>;
}

/** The numbered screen a route shows first (the taste sliders count from `taste-spicy`). */
const SCREEN_OF_ROUTE: Record<SliderFlowRoute, OnboardingFlowScreen> = {
  OnboardingWelcome: "splash",
  OnboardingName: "name",
  LocationPermission: "location",
  OnboardingAreas: "areas",
  OnboardingMealTimes: "meal-times",
  OnboardingPalateIntro: "palate-intro",
  TasteQuiz: "taste-spicy",
  OnboardingPalateReveal: "palate-reveal",
  DietaryPreferences: "dietary",
  OnboardingDishGrid: "dish-grid",
  OnboardingPrice: "price",
  FoodOpenness: "openness",
  OnboardingSwipe: "swipe",
  OnboardingLoading: "loading",
  OnboardingResults: "results",
  OnboardingMealPicks: "meal-picks",
  OnboardingAuth: "account",
};

export function flowScreenForRoute(route: SliderFlowRoute): OnboardingFlowScreen {
  return SCREEN_OF_ROUTE[route];
}
