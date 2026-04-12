import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";

import { Screen, AppText, HungryLogo } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface AuthScreenShellProps {
  title: string;
  subtitle: string;
  footer?: ReactNode;
}

export function AuthScreenShell({ children, title, subtitle, footer }: PropsWithChildren<AuthScreenShellProps>) {
  const { palette, spacing } = useHungryTheme();

  return (
    <Screen scroll>
      <View style={{ gap: spacing[6], paddingVertical: spacing[4], marginTop: spacing[4] }}>
        <View style={{ alignItems: "center", gap: spacing[8], marginBottom: spacing[4] }}>
          <HungryLogo size={140} showWordmark wordmarkColor={palette.navy} />
          <View style={{ alignItems: "center", gap: spacing[1] }}>
            <AppText variant="h1" style={{ textAlign: "center", fontSize: 24 }}>{title}</AppText>
            <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>{subtitle}</AppText>
          </View>
        </View>
        <View style={{ gap: spacing[4] }}>
          {children}
        </View>
        {footer ? <View style={{ gap: spacing[3] }}>{footer}</View> : null}
        <AppText variant="bodySmall" tone="muted" style={{ textAlign: "center", opacity: 0.6 }}>
          Hungry keeps this flow simple so you can get into dish discovery quickly.
        </AppText>
      </View>
    </Screen>
  );
}
