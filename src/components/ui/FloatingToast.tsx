import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { CircleCheck, CircleAlert, TriangleAlert, Info } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import { AppText } from "./AppText";

export function FloatingToast() {
  const toast = useUIStore((state) => state.toast);
  const clearToast = useUIStore((state) => state.clearToast);
  const { motion, palette, radii, shadows, spacing, zIndex } = useHungryTheme();
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

    const timer = setTimeout(() => clearToast(), motion.toastAutoDismiss);
    return () => clearTimeout(timer);
  }, [toast, clearToast, motion.toastAutoDismiss, tone]);

  if (!toast) return null;

  const toneConfig = {
    success: { bg: palette.orange, icon: CircleCheck, color: "#FFFFFF" },
    warning: { bg: palette.amber, icon: TriangleAlert, color: "#FFFFFF" },
    error: { bg: palette.error, icon: CircleAlert, color: "#FFFFFF" },
    info: { bg: palette.navy, icon: Info, color: "#FFFFFF" },
  }[tone] || { bg: palette.navy, icon: Info, color: "#FFFFFF" };

  const Icon = toneConfig.icon;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { zIndex: zIndex.toast }]}>
      <Animated.View 
        entering={FadeInDown.duration(motion.toast)}
        exiting={FadeOutUp.duration(motion.toast)}
      >
        <Pressable
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          onPress={clearToast}
          style={[
            shadows.floating,
            {
              backgroundColor: toneConfig.bg,
              borderRadius: radii.md,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[3],
            },
          ]}
        >
          <Icon size={20} color={toneConfig.color} />
          <AppText style={{ color: toneConfig.color, fontWeight: "700", flex: 1 }}>{toast.message}</AppText>
        </Pressable>
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
