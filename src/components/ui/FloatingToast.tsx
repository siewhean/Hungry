import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import { AppText } from "./AppText";

export function FloatingToast() {
  const toast = useUIStore((state) => state.toast);
  const clearToast = useUIStore((state) => state.clearToast);
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const tone = toast?.tone ?? "info";
  const toneBackground =
    tone === "success"
      ? palette.success
      : tone === "warning"
        ? palette.warningSoft
        : tone === "error"
          ? palette.error
          : palette.navy;
  const toastTextTone = tone === "warning" ? "default" : "inverse";

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(() => clearToast(), 2500);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) {
    return null;
  }

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
