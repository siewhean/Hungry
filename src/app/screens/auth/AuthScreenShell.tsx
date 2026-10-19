import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Screen, AppText, HungryLogo } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { HUNGRY_LOGO_STANDARD_SIZE } from "@/constants/brandAssets";
import { useKeyboardRevealFocusedInput } from "@/hooks/useKeyboardRevealFocusedInput";
import { AuthBrandHeader } from "./AuthBrandHeader";

interface AuthScreenShellProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  wordmarkColor?: string;
  compact?: boolean;
  contentOffsetTop?: number;
  /**
   * "balanced" (Login / Create account): the shared AuthBrandHeader sits at a fixed
   * top position and the form block is centred in the remaining height above the
   * footer via flex spacers, collapsing to scroll on short screens / open keyboard.
   * "stack" (default): header and form flow from the top.
   */
  layout?: "stack" | "balanced";
  /**
   * Primary action pinned below the scroll area. It sits inside the
   * KeyboardAvoidingView, so on iOS it rides above the keyboard and is never
   * hidden by it, however long the form is.
   */
  stickyAction?: ReactNode;
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
 * - Forms with a `stickyAction` keep that action outside the ScrollView, pinned
 *   above the keyboard.
 */
export function AuthScreenShell({
  children,
  title,
  subtitle,
  footer,
  wordmarkColor,
  compact = false,
  contentOffsetTop = 0,
  layout = "stack",
  stickyAction,
}: PropsWithChildren<AuthScreenShellProps>) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const gap = compact ? spacing[3] : spacing[6];
  const titleGap = compact ? spacing[4] : spacing[8];
  const innerGap = compact ? spacing[3] : spacing[4];
  const footerTopGap = compact ? spacing[2] : spacing[3];
  const isBalanced = layout === "balanced";
  const effectiveWordmarkColor = wordmarkColor ?? palette.navy;
  const keyboardReveal = useKeyboardRevealFocusedInput();
  const keyboardVisible = useKeyboardVisible(Boolean(stickyAction));

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
            // With a sticky action the safe-area inset belongs to the pinned footer.
            paddingBottom: stickyAction
              ? spacing[4]
              : Math.max(insets.bottom, spacing[4]) + spacing[4],
          }}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isBalanced ? (
            <View
              // TextInput focus bubbles: re-reveal when focus moves while the keyboard is open.
              onFocus={keyboardReveal.onFocus}
              style={{ flexGrow: 1 }}
            >
              <AuthBrandHeader title={title} subtitle={subtitle} />
              {/* Equal flex spacers centre the form between header and footer. */}
              <View style={{ flexGrow: 1, minHeight: spacing[6] }} />
              <View style={{ gap: innerGap }}>{children}</View>
              {footer ? <View style={{ gap: footerTopGap, marginTop: gap }}>{footer}</View> : null}
              <View style={{ flexGrow: 1, minHeight: spacing[3] }} />
            </View>
          ) : (
            <View
              // TextInput focus bubbles: re-reveal when focus moves while the keyboard is open.
              onFocus={keyboardReveal.onFocus}
              style={{ gap, paddingVertical: spacing[3], marginTop: spacing[3] + contentOffsetTop }}
            >
              <View style={{ alignItems: "center", gap: titleGap, marginBottom: innerGap }}>
                <HungryLogo
                  size={HUNGRY_LOGO_STANDARD_SIZE}
                  showWordmark
                  wordmarkColor={effectiveWordmarkColor}
                />
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
          )}
        </ScrollView>
        {stickyAction ? (
          <View
            style={{
              borderTopColor: palette.border,
              borderTopWidth: 1,
              gap: spacing[2],
              // The home-indicator inset sits under the keyboard while it is open.
              paddingBottom: keyboardVisible ? spacing[2] : Math.max(insets.bottom, spacing[3]),
              paddingTop: spacing[3],
            }}
          >
            {stickyAction}
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function useKeyboardVisible(enabled: boolean) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);
  return visible;
}
