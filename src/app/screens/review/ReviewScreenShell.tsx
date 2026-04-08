import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { AppText, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface ReviewScreenShellProps {
  title: string;
  subtitle: string;
  step: number;
  total: number;
}

export function ReviewScreenShell({ children, title, subtitle, step, total }: PropsWithChildren<ReviewScreenShellProps>) {
  const { palette, radii, spacing } = useHungryTheme();
  const progress = Math.max(0, Math.min(100, (step / total) * 100));

  return (
    <Screen title={title} subtitle={subtitle} scroll>
      <View style={{ gap: spacing[2] }}>
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: palette.orangeLight,
            borderRadius: radii.pill,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1],
          }}
        >
          <AppText variant="micro" style={{ color: palette.orange, textTransform: "uppercase" }}>
            Step {step} of {total}
          </AppText>
        </View>
        <View
          style={{
            backgroundColor: palette.border,
            borderRadius: radii.pill,
            height: 6,
            overflow: "hidden",
            width: "100%",
          }}
        >
          <View
            style={{
              width: `${progress}%` as `${number}%`,
              height: "100%",
              backgroundColor: palette.orange,
            }}
          />
        </View>
      </View>
      <View style={{ gap: spacing[4] }}>{children}</View>
    </Screen>
  );
}
