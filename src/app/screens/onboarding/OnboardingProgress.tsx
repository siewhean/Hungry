import { View } from "react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** The whole first-run flow: welcome, location, optional taste quiz, done. */
export const ONBOARDING_STEPS = ["welcome", "location", "taste", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The one progress indicator every onboarding screen shows: "Step x of N". */
export function OnboardingProgress({ step }: { step: OnboardingStep }) {
  const { palette, radii, spacing } = useHungryTheme();
  const current = ONBOARDING_STEPS.indexOf(step) + 1;
  const total = ONBOARDING_STEPS.length;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={{ gap: spacing[1] }}
    >
      <View style={{ flexDirection: "row", gap: spacing[1] }}>
        {ONBOARDING_STEPS.map((name, index) => (
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
