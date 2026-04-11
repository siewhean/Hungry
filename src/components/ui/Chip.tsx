import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leftIcon?: ReactNode;
}

export function Chip({ label, selected = false, onPress, leftIcon }: ChipProps) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? palette.orangeLight : palette.surface,
          borderColor: selected ? palette.orange : "#000000",
          borderRadius: radii.md,
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[2],
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {leftIcon}
      <AppText style={{ color: selected ? palette.orange : palette.textSecondary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
  },
});
