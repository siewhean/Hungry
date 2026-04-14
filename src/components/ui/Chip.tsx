import { type ReactNode } from "react";
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
  const { palette, radii, spacing, colorScheme } = useHungryTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected 
            ? palette.orangeLight 
            : (colorScheme === "dark" ? palette.surfaceRaised : palette.surface),
          borderColor: selected ? palette.orange : palette.border,
          borderRadius: radii.pill,
          minHeight: 44,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          opacity: pressed ? 0.85 : 1,
          justifyContent: "center",
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        {leftIcon}
        <AppText style={{ color: selected ? palette.orange : palette.textSecondary, fontWeight: selected ? "700" : "500" }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
  },
});
