import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "@/lib/haptics";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { CircleCheck, CircleAlert, TriangleAlert, Info } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import { AppText } from "./AppText";

export function FloatingToast() {
  const toast = useUIStore((state) => state.toast);
  const clearToast = useUIStore((state) => state.clearToast);
  const { componentCornerCurve, componentRadii, motion, palette, shadows, spacing, zIndex } =
    useHungryTheme();
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

  const toneConfig = {
    success: {
      bg: palette.surface,
      border: palette.orange,
      icon: CircleCheck,
      color: palette.success,
    },
    warning: {
      bg: palette.surface,
      border: palette.orange,
      icon: TriangleAlert,
      color: palette.warning,
    },
    error: {
      bg: palette.surface,
      border: palette.orange,
      icon: CircleAlert,
      color: palette.error,
    },
    info: {
      bg: palette.surface,
      border: palette.orange,
      icon: Info,
      color: palette.info,
    },
  }[tone] || {
    bg: palette.surface,
    border: palette.orange,
    icon: Info,
    color: palette.text,
  };
  const toastBackgroundColor = toast.backgroundColor ?? toneConfig.bg;
  const toastBorderColor = toast.borderColor ?? toneConfig.border;
  const toastTextColor = toast.textColor ?? toneConfig.color;
  const toastIconColor = toast.iconColor ?? toneConfig.color;
  const toastBorderWidth = toast.borderWidth ?? 1;

  const Icon = toneConfig.icon;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { zIndex: zIndex.toast }]}>
      <Animated.View
        entering={FadeInDown.duration(motion.toast)}
        exiting={FadeOutUp.duration(motion.toast)}
      >
        {(() => {
          const toastStyle = [
            shadows.floating,
            {
              backgroundColor: toastBackgroundColor,
              borderColor: toastBorderColor,
              borderWidth: toastBorderWidth,
              opacity: 1,
              borderRadius: componentRadii.card,
              borderCurve: componentCornerCurve.borderCurve,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              flexDirection: "row" as const,
              alignItems: "center" as const,
              gap: spacing[3],
            },
          ];
          const content = (
            <>
              <Icon size={20} color={toastIconColor} />
              <AppText style={{ color: toastTextColor, fontWeight: "700", flex: 1 }}>
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
    bottom: 24,
    left: 16,
    position: "absolute",
    right: 16,
  },
});
