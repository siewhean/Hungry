import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { AppText, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface ReviewScreenShellProps {
  title: string;
  subtitle: string;
  stepLabel: string;
}

export function ReviewScreenShell({ children, title, subtitle, stepLabel }: PropsWithChildren<ReviewScreenShellProps>) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Screen title={title} subtitle={subtitle} scroll>
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
          {stepLabel}
        </AppText>
      </View>
      <View style={{ gap: spacing[4] }}>{children}</View>
    </Screen>
  );
}

