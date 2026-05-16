import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";

import { Screen, AppText, HungryLogo } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface AuthScreenShellProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  wordmarkColor?: string;
  compact?: boolean;
  scroll?: boolean;
  contentOffsetTop?: number;
}

export function AuthScreenShell({
  children,
  title,
  subtitle,
  footer,
  wordmarkColor,
  compact = false,
  scroll = true,
  contentOffsetTop = 0,
}: PropsWithChildren<AuthScreenShellProps>) {
  const { palette, spacing } = useHungryTheme();
  const gap = compact ? spacing[3] : spacing[6];
  const titleGap = compact ? spacing[4] : spacing[8];
  const innerGap = compact ? spacing[3] : spacing[4];
  const footerTopGap = compact ? spacing[2] : spacing[3];
  const logoSize = compact ? 104 : 140;
  const effectiveWordmarkColor = wordmarkColor ?? palette.navy;

  return (
    <Screen scroll={scroll}>
      <View style={{ gap, paddingVertical: spacing[3], marginTop: spacing[3] + contentOffsetTop }}>
        <View style={{ alignItems: "center", gap: titleGap, marginBottom: innerGap }}>
          <HungryLogo size={logoSize} showWordmark wordmarkColor={effectiveWordmarkColor} />
          <View style={{ alignItems: "center", gap: spacing[1] }}>
            <AppText variant="h1" style={{ textAlign: "center", fontSize: 24 }}>
              {title}
            </AppText>
            {subtitle ? (
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
