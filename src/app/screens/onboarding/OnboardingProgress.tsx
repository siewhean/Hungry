import { View } from "react-native";

import { FlowProgressBar } from "@/components/onboarding/FlowProgressBar";
import { AppText } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { OnboardingFlowScreen } from "@/features/onboarding/onboardingFlow";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useHungryTheme } from "@/theme";

/**
 * The whole first-run flow: welcome, location, optional taste quiz, food openness, the first
 * picks ("done") and the account step. Setup is not finished until the account exists.
 */
export const ONBOARDING_STEPS = [
  "welcome",
  "location",
  "taste",
  "openness",
  "done",
  "account",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Welcome is the front door, not a task: the counter starts at Location and runs to the account step. */
const PROGRESS_STEPS = ONBOARDING_STEPS.filter((name) => name !== "welcome");

/** The "Step x of N" number the user sees for a step; 0 for Welcome, which shows no counter. */
export function visibleStepNumber(step: OnboardingStep): number {
  return PROGRESS_STEPS.indexOf(step as (typeof PROGRESS_STEPS)[number]) + 1;
}

/**
 * Onboarding funnel: one event per step shown, tagged with the onboarding surface.
 * step_number matches the on-screen counter; step_index is the position in the whole flow.
 */
export function trackOnboardingStepViewed(step: OnboardingStep) {
  trackAnalyticsEvent("onboarding_step_viewed", {
    step,
    step_number: visibleStepNumber(step),
    step_index: ONBOARDING_STEPS.indexOf(step) + 1,
    surface: "onboarding",
  });
}

/** What the result grid ended up showing, once it settles. */
export function trackOnboardingPicksShown(picks: {
  ranked: boolean;
  count: number;
  source: "local" | "server" | "popular" | "error";
}) {
  trackAnalyticsEvent("onboarding_picks_shown", { ...picks, surface: "onboarding" });
}

export function trackOnboardingStepSkipped(step: OnboardingStep) {
  trackAnalyticsEvent("onboarding_step_skipped", { step, surface: "onboarding" });
}

/** One event per taste question and for the dietary step, so the funnel shows where people quit. */
export function trackOnboardingQuestionViewed(key: string, index: number) {
  trackAnalyticsEvent("onboarding_question_viewed", { key, index, surface: "onboarding" });
}

/** The manual area picker sits inside the Location step; this lets the funnel see it. */
export function trackOnboardingAreaPickerViewed() {
  trackAnalyticsEvent("onboarding_area_picker_viewed", { surface: "onboarding" });
}

/** Where each step sits in the 22-screen slider flow (the taste step here is the dietary part). */
const SLIDER_FLOW_SCREEN: Record<OnboardingStep, OnboardingFlowScreen> = {
  welcome: "splash",
  location: "location",
  taste: "dietary",
  openness: "openness",
  done: "results",
  account: "account",
};

/**
 * The one progress indicator every onboarding screen shows: "Step x of N". With the slider
 * onboarding on it is the single bar across all 22 screens instead.
 * `subProgress` (0 to 1) fills part of the current segment, for the questions inside a step;
 * `detail` is the sentence that goes with it ("Question 3 of 7").
 */
export function OnboardingProgress({
  step,
  subProgress,
  detail,
}: {
  step: OnboardingStep;
  subProgress?: number;
  detail?: string;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  if (FEATURE_FLAGS.sliderOnboardingEnabled) {
    return <FlowProgressBar screen={SLIDER_FLOW_SCREEN[step]} />;
  }
  const current = visibleStepNumber(step);
  const total = PROGRESS_STEPS.length;
  if (current === 0) return null;
  const partial = subProgress === undefined ? 1 : Math.max(0, Math.min(1, subProgress));
  const caption = detail
    ? `Step ${current} of ${total} · ${detail}`
    : `Step ${current} of ${total}`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={caption}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={{ gap: spacing[1] }}
    >
      <View style={{ flexDirection: "row", gap: spacing[1] }}>
        {PROGRESS_STEPS.map((name, index) => {
          const fill = index + 1 < current ? 1 : index + 1 === current ? partial : 0;
          return (
            <View
              key={name}
              testID={`onboarding-progress-segment-${index + 1}`}
              style={{
                backgroundColor: palette.border,
                borderRadius: radii.pill,
                flex: 1,
                height: 4,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  backgroundColor: palette.orange,
                  height: 4,
                  width: `${Math.round(fill * 100)}%`,
                }}
              />
            </View>
          );
        })}
      </View>
      <AppText variant="micro" tone="muted">
        {caption}
      </AppText>
    </View>
  );
}
