import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";

import { Screen, AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface AuthScreenShellProps {
  title: string;
  subtitle: string;
  footer?: ReactNode;
}

export function AuthScreenShell({ children, title, subtitle, footer }: PropsWithChildren<AuthScreenShellProps>) {
  const { spacing } = useHungryTheme();

  return (
    <Screen scroll>
      <View style={{ gap: spacing[5] }}>
        <View style={{ gap: spacing[2] }}>
          <AppText variant="micro" tone="accent">
            HUNGRY
          </AppText>
          <AppText variant="h1">{title}</AppText>
          <AppText tone="secondary">{subtitle}</AppText>
        </View>
        <View style={{ gap: spacing[4] }}>
          {children}
        </View>
        {footer ? <View style={{ gap: spacing[3] }}>{footer}</View> : null}
        <AppText variant="bodySmall" tone="muted">
          Hungry keeps this flow simple so you can get into dish discovery quickly.
        </AppText>
      </View>
    </Screen>
  );
}
