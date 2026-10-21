import { View } from "react-native";

import { AppText } from "@/components/ui";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useHungryTheme } from "@/theme";

/** The whole first-run flow: welcome, location, optional taste quiz, food openness, done. */
export const ONBOARDING_STEPS = ["welcome", "location", "taste", "openness", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Welcome is the front door, not a task: the counter starts at Location and runs to Done. */
const PROGRESS_STEPS = ONBOARDING_STEPS.filter((name) => name !== "welcome");

/** Onboarding funnel: one event per step shown, tagged with the onboarding surface. */
export function trackOnboardingStepViewed(step: OnboardingStep) {
  trackAnalyticsEvent("onboarding_step_viewed", {
    step,
    step_number: ONBOARDING_STEPS.indexOf(step) + 1,
    surface: "onboarding",
  });
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

/** The one progress indicator every onboarding screen shows: "Step x of N". */
export function OnboardingProgress({ step }: { step: OnboardingStep }) {
  const { palette, radii, spacing } = useHungryTheme();
  const current = PROGRESS_STEPS.indexOf(step as (typeof PROGRESS_STEPS)[number]) + 1;
  const total = PROGRESS_STEPS.length;
  if (current === 0) return null;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={{ gap: spacing[1] }}
    >
      <View style={{ flexDirection: "row", gap: spacing[1] }}>
        {PROGRESS_STEPS.map((name, index) => (
          <View
            key={name}
            style={{
              backgroundColor: index < current ? palette.orange : palette.border,
              borderRadius: radii.pill,
              flex: 1,
              height: 4,
            }}
          />
        ))}
      </View>
      <AppText variant="micro" tone="muted">
        Step {current} of {total}
      </AppText>
    </View>
  );
}
