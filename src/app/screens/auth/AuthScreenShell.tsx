import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";

import { Screen, AppText, HungryLogo } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { HUNGRY_LOGO_STANDARD_SIZE } from "@/constants/brandAssets";

interface AuthScreenShellProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  wordmarkColor?: string;
  compact?: boolean;
}

export function AuthScreenShell({
  children,
  title,
  subtitle,
  footer,
  wordmarkColor,
  compact = false,
}: PropsWithChildren<AuthScreenShellProps>) {
  const { palette, spacing } = useHungryTheme();
  const gap = compact ? spacing[3] : spacing[6];
  const titleGap = compact ? spacing[4] : spacing[8];
  const innerGap = compact ? spacing[3] : spacing[4];
  const footerTopGap = compact ? spacing[2] : spacing[3];
  const logoSize = HUNGRY_LOGO_STANDARD_SIZE;
  const effectiveWordmarkColor = wordmarkColor ?? palette.navy;

  return (
    // Auth forms always scroll and lift above the keyboard so the submit button stays reachable.
    <Screen keyboardAvoiding>
      <View style={{ gap, paddingVertical: spacing[3], marginTop: spacing[3] }}>
        <View style={{ alignItems: "center", gap: titleGap, marginBottom: innerGap }}>
          <HungryLogo size={logoSize} showWordmark wordmarkColor={effectiveWordmarkColor} />
          <View style={{ alignItems: "center", gap: spacing[1] }}>
            {title.trim().length > 0 ? (
              <AppText variant="h1" style={{ textAlign: "center", fontSize: 24 }}>
                {title}
              </AppText>
            ) : null}
            {subtitle?.trim().length ? (
              <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </View>
        <View style={{ gap: innerGap }}>{children}</View>
        {footer ? <View style={{ gap: footerTopGap }}>{footer}</View> : null}
      </View>
    </Screen>
  );
}
