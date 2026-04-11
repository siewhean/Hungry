import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";

import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import { AppText } from "./AppText";

export function FloatingToast() {
  const toast = useUIStore((state) => state.toast);
  const clearToast = useUIStore((state) => state.clearToast);
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const tone = toast?.tone ?? "info";

  useEffect(() => {
    if (!toast) {
      return;
    }

    // Trigger haptic feedback based on toast tone
    if (tone === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (tone === "error") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (tone === "warning") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const timer = setTimeout(() => clearToast(), 2500);
    return () => clearTimeout(timer);
  }, [toast, clearToast, tone]);

  if (!toast) {
    return null;
  }

  const toneBackground =
    tone === "success"
      ? palette.success
      : tone === "warning"
        ? palette.warningSoft
        : tone === "error"
          ? palette.error
          : palette.navy;
  const toastTextTone = tone === "warning" ? "default" : "inverse";

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onPress={clearToast}
        style={[
          shadows.floating,
          {
            backgroundColor: toneBackground,
            borderColor: tone === "warning" ? palette.warning : "transparent",
            borderWidth: tone === "warning" ? 1 : 0,
            borderRadius: radii.md,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
          },
        ]}
      >
        <AppText tone={toastTextTone}>{toast.message}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    bottom: 24,
    left: 16,
    position: "absolute",
    right: 16,
    zIndex: 30,
  },
});
