import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import { AppText } from "./AppText";

export function FloatingToast() {
  const toast = useUIStore((state) => state.toast);
  const clearToast = useUIStore((state) => state.clearToast);
  const { palette, radii, shadows, spacing } = useHungryTheme();

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
        onPress={clearToast}
        style={[
          shadows.floating,
          {
            backgroundColor: palette.navy,
            borderRadius: radii.md,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
          },
        ]}
      >
        <AppText tone="inverse">{toast.message}</AppText>
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
  },
});

