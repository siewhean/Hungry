import type { ReactNode } from "react";
import { View } from "react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/**
 * The one heading every onboarding step uses (Welcome, the front door, is the exception):
 * left-aligned, the app's display serif at a single size, then a one-line subtitle. The step
 * bar (`OnboardingProgress`) sits above it.
 */
export function OnboardingHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Extra lines under the subtitle, such as a taste summary. */
  children?: ReactNode;
}) {
  const { spacing } = useHungryTheme();
  return (
    <View style={{ gap: spacing[1] }}>
      <AppText variant="displaySm" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="bodySmall" tone="secondary">
          {subtitle}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}
