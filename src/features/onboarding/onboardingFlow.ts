import type { TasteKey } from "@/types/domain";
import { TASTE_SLIDER_ORDER } from "./tasteSliderStops";

/**
 * Every screen of the new first-run flow, in order. One progress bar runs across all of them, so
 * the position of a screen is its place in this list. Splash is screen 1 and the account is last.
 */
export const ONBOARDING_FLOW = [
  "splash",
  "name",
  "location",
  "areas",
  "meal-times",
  "palate-intro",
  "taste-spicy",
  "taste-sweet",
  "taste-salty",
  "taste-sour",
  "taste-rich",
  "taste-aromatic",
  "palate-reveal",
  "dietary",
  "dish-grid",
  "price",
  "openness",
  "swipe",
  "loading",
  "results",
  "meal-picks",
  "account",
] as const;

export type OnboardingFlowScreen = (typeof ONBOARDING_FLOW)[number];

export const ONBOARDING_FLOW_LENGTH = ONBOARDING_FLOW.length;

/** The flow id of the slider question for a taste. */
export function tasteFlowScreen(key: TasteKey): OnboardingFlowScreen {
  return `taste-${key}` as OnboardingFlowScreen;
}

/** The flow id of the nth taste question (0 to 5). */
export function tasteFlowScreenAt(index: number): OnboardingFlowScreen {
  const key = TASTE_SLIDER_ORDER[Math.max(0, Math.min(TASTE_SLIDER_ORDER.length - 1, index))]!;
  return tasteFlowScreen(key);
}

/** 1-based position, so "screen 7 of 22". */
export function flowPosition(screen: OnboardingFlowScreen): { current: number; total: number } {
  return { current: ONBOARDING_FLOW.indexOf(screen) + 1, total: ONBOARDING_FLOW_LENGTH };
}

/** 0 to 1: how much of the single progress bar is filled on this screen. */
export function flowProgressFraction(screen: OnboardingFlowScreen): number {
  const { current, total } = flowPosition(screen);
  return current / total;
}
