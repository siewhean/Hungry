import { Pressable, StyleSheet } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? palette.orangeLight : palette.bgMuted,
          borderColor: selected ? palette.orange : palette.border,
          borderRadius: radii.pill,
          minHeight: 44,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <AppText tone={selected ? "accent" : "secondary"}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
  },
});
