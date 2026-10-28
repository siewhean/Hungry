import type { PropsWithChildren, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { Screen, AppText, HungryLogo } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { HUNGRY_LOGO_STANDARD_SIZE } from "@/constants/brandAssets";
import { useKeyboardRevealFocusedInput } from "@/hooks/useKeyboardRevealFocusedInput";

export const AUTH_COMPACT_LOGO_SIZE = 48;

interface AuthScreenShellProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  /** Overrides the wordmark colour; the default follows the theme's text colour. */
  wordmarkColor?: string;
  /**
   * Form screens: a 48 px mark with no wordmark, so the primary button stays above the fold on a
   * 320x568 phone. The full logo belongs on Welcome.
   */
  compact?: boolean;
  /** Shows a back chevron on pushed screens (the app is sign-in only: no close control). */
  onBack?: () => void;
  backLabel?: string;
}

/**
 * Keyboard contract (shared by every auth form):
 * - KeyboardAvoidingView lifts content above the iOS keyboard so the primary
 *   action stays reachable.
 * - The ScrollView uses keyboardShouldPersistTaps="handled": tapping a button
 *   works on the first tap, and tapping empty background dismisses the keyboard.
 * - KeyboardAvoidingView only shrinks the viewport; a ScrollView never scrolls a
 *   focused TextInput into view by itself. When the keyboard opens (or focus moves
 *   while it is open) the shell scrolls so the focused field plus the space below
 *   it (next field / primary button) sits above the keyboard.
 */
export function AuthScreenShell({
  children,
  title,
  subtitle,
  footer,
  wordmarkColor,
  compact = false,
  onBack,
  backLabel = "Back",
}: PropsWithChildren<AuthScreenShellProps>) {
  const { componentSizes, palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const gap = compact ? spacing[3] : spacing[6];
  const titleGap = compact ? spacing[4] : spacing[8];
  const innerGap = compact ? spacing[3] : spacing[4];
  const footerTopGap = compact ? spacing[2] : spacing[3];
  const logoSize = compact ? AUTH_COMPACT_LOGO_SIZE : HUNGRY_LOGO_STANDARD_SIZE;
  // The navy token is near-black in dark mode; the text colour follows the theme.
  const effectiveWordmarkColor = wordmarkColor ?? palette.text;
  const keyboardReveal = useKeyboardRevealFocusedInput();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ backgroundColor: palette.bg, flex: 1 }}
    >
      <Screen scroll={false}>
        <ScrollView
          ref={keyboardReveal.scrollRef}
          onScroll={keyboardReveal.onScroll}
          scrollEventThrottle={keyboardReveal.scrollEventThrottle}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Math.max(insets.bottom, spacing[4]) + spacing[4],
          }}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            // TextInput focus bubbles: re-reveal when focus moves while the keyboard is open.
            onFocus={keyboardReveal.onFocus}
            style={{ gap, paddingVertical: spacing[3], marginTop: spacing[3] }}
          >
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={backLabel}
                onPress={onBack}
                hitSlop={8}
                style={{
                  alignItems: "center",
                  alignSelf: "flex-start",
                  justifyContent: "center",
                  minHeight: componentSizes.touchTarget,
                  minWidth: componentSizes.touchTarget,
                }}
              >
                <ArrowLeft color={palette.text} size={22} />
              </Pressable>
            ) : null}
            <View style={{ alignItems: "center", gap: titleGap, marginBottom: innerGap }}>
              <HungryLogo
                size={logoSize}
                showWordmark={!compact}
                wordmarkColor={effectiveWordmarkColor}
              />
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
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
