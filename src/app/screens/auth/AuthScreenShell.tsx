import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ArrowLeft, X } from "lucide-react-native";

import { Screen, AppText, HungryLogo } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { HUNGRY_LOGO_STANDARD_SIZE } from "@/constants/brandAssets";

interface AuthScreenShellProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  /** Overrides the wordmark colour; the default follows the theme's text colour. */
  wordmarkColor?: string;
  compact?: boolean;
  /** Shows a close (X) control so the screen is never a dead end. */
  onClose?: () => void;
  closeLabel?: string;
  /** Shows a back chevron on pushed screens that have no close control. */
  onBack?: () => void;
  backLabel?: string;
}

export function AuthScreenShell({
  children,
  title,
  subtitle,
  footer,
  wordmarkColor,
  compact = false,
  onClose,
  closeLabel = "Close",
  onBack,
  backLabel = "Back",
}: PropsWithChildren<AuthScreenShellProps>) {
  const { componentSizes, palette, spacing } = useHungryTheme();
  const gap = compact ? spacing[3] : spacing[6];
  const titleGap = compact ? spacing[4] : spacing[8];
  const innerGap = compact ? spacing[3] : spacing[4];
  const footerTopGap = compact ? spacing[2] : spacing[3];
  const logoSize = HUNGRY_LOGO_STANDARD_SIZE;
  // The navy token is near-black in dark mode; the text colour follows the theme.
  const effectiveWordmarkColor = wordmarkColor ?? palette.text;

  return (
    // Auth forms always scroll and lift above the keyboard so the submit button stays reachable.
    <Screen keyboardAvoiding>
      <View style={{ gap, paddingVertical: spacing[3], marginTop: spacing[3] }}>
        {onClose || onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={onClose ? closeLabel : backLabel}
            onPress={onClose ?? onBack}
            hitSlop={8}
            style={{
              alignItems: "center",
              alignSelf: "flex-start",
              justifyContent: "center",
              minHeight: componentSizes.touchTarget,
              minWidth: componentSizes.touchTarget,
            }}
          >
            {onClose ? (
              <X color={palette.text} size={22} />
            ) : (
              <ArrowLeft color={palette.text} size={22} />
            )}
          </Pressable>
        ) : null}
        <View style={{ alignItems: "center", gap: titleGap, marginBottom: innerGap }}>
          <HungryLogo size={logoSize} showWordmark wordmarkColor={effectiveWordmarkColor} />
          <View style={{ alignItems: "center", gap: spacing[1] }}>
            {title.trim().length > 0 ? (
              <AppText variant="h1" accessibilityRole="header" style={{ textAlign: "center" }}>
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
