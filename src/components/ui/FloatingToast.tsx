import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { CircleCheck, CircleAlert, TriangleAlert, Info } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import { AppText } from "./AppText";

export function FloatingToast() {
  const toast = useUIStore((state) => state.toast);
  const clearToast = useUIStore((state) => state.clearToast);
  const { componentSizes, motion, palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const tone = toast?.tone ?? "info";

  useEffect(() => {
    if (!toast) return;

    if (tone === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (tone === "error") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (tone === "warning") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const autoDismissMs = toast.duration ?? motion.toastAutoDismiss;
    const timer = setTimeout(() => clearToast(), autoDismissMs);
    return () => clearTimeout(timer);
  }, [toast, clearToast, motion.toastAutoDismiss, tone]);

  if (!toast) return null;

  // Sits above the tab bar and its safe-area inset, so the tab labels stay readable.
  const toastBottom =
    componentSizes.bottomTabBar + Math.max(insets.bottom, spacing[2]) + spacing[2];

  // A compact inverted pill (dark on light, light on dark): the tone shows in the icon, not a border.
  const toneConfig = {
    success: { icon: CircleCheck, color: palette.success },
    warning: { icon: TriangleAlert, color: palette.warning },
    error: { icon: CircleAlert, color: palette.error },
    info: { icon: Info, color: palette.info },
  }[tone] || { icon: Info, color: palette.info };
  const toastBackgroundColor = toast.backgroundColor ?? palette.text;
  const toastTextColor = toast.textColor ?? palette.bg;
  const toastIconColor = toast.iconColor ?? toneConfig.color;
  const toastBorderWidth = toast.borderWidth ?? (toast.borderColor ? 1 : 0);

  const Icon = toneConfig.icon;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: toastBottom, zIndex: zIndex.toast }]}
    >
      <Animated.View
        entering={FadeInDown.duration(motion.toast)}
        exiting={FadeOutUp.duration(motion.toast)}
      >
        {(() => {
          const toastStyle = [
            shadows.floating,
            {
              backgroundColor: toastBackgroundColor,
              ...(toast.borderColor
                ? { borderColor: toast.borderColor, borderWidth: toastBorderWidth }
                : {}),
              opacity: 1,
              alignSelf: "center" as const,
              maxWidth: "100%" as const,
              borderRadius: radii.pill,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[2],
              flexDirection: "row" as const,
              alignItems: "center" as const,
              gap: spacing[2],
            },
          ];
          const content = (
            <>
              <Icon size={18} color={toastIconColor} />
              <AppText style={{ color: toastTextColor, fontWeight: "700", flexShrink: 1 }}>
                {toast.message}
              </AppText>
            </>
          );
          // With an action the toast is a plain alert box: a button inside a pressable would
          // nest two buttons (invalid on web), so only the action button is pressable.
          if (toast.action) {
            const action = toast.action;
            return (
              <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={toastStyle}>
                {content}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  hitSlop={8}
                  onPress={() => {
                    clearToast();
                    action.onPress();
                  }}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing[2] }}
                >
                  <AppText style={{ color: palette.orange, fontWeight: "700" }}>
                    {action.label}
                  </AppText>
                </Pressable>
              </View>
            );
          }
          return (
            <Pressable
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              onPress={clearToast}
              style={toastStyle}
            >
              {content}
            </Pressable>
          );
        })()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    left: 16,
    position: "absolute",
    right: 16,
  },
});
