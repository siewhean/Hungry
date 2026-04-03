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
    <Screen title={title} subtitle={subtitle} scroll>
      <View style={{ gap: spacing[4] }}>
        {children}
        {footer ? <View style={{ gap: spacing[3] }}>{footer}</View> : null}
        <AppText variant="bodySmall" tone="muted">
          Hungry keeps this flow simple. You can finish setup in a few steps.
        </AppText>
      </View>
    </Screen>
  );
}

