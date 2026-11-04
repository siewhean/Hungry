import { View } from "react-native";

import {
  flowPosition,
  flowProgressFraction,
  type OnboardingFlowScreen,
} from "@/features/onboarding/onboardingFlow";
import { useHungryTheme } from "@/theme";

/** One bar for the whole first-run flow: it fills a little further on every screen. */
export function FlowProgressBar({ screen }: { screen: OnboardingFlowScreen }) {
  const { palette, radii } = useHungryTheme();
  const { current, total } = flowPosition(screen);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Screen ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={{
        backgroundColor: palette.border,
        borderRadius: radii.pill,
        height: 4,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          backgroundColor: palette.orange,
          borderRadius: radii.pill,
          height: 4,
          width: `${Math.round(flowProgressFraction(screen) * 100)}%`,
        }}
      />
    </View>
  );
}
