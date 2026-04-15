import { Pressable, StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface ClusterPinProps {
  count: number;
  onPress?: () => void;
}

export function ClusterPin({ count, onPress }: ClusterPinProps) {
  const { palette, radii, shadows } = useHungryTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${count} places in this cluster`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pin,
        shadows.floating,
        {
          backgroundColor: palette.orange,
          borderRadius: radii.pill,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <AppText variant="bodySmall" tone="inverse">
        {count}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pin: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
});

