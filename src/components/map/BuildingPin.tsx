import { Pressable, StyleSheet, View } from "react-native";
import { MapPin } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";
import type { BuildingType } from "@/types/domain";

interface BuildingPinProps {
  name: string;
  type: BuildingType;
  selected?: boolean;
  onPress?: () => void;
}

export function BuildingPin({ name, type, selected = false, onPress }: BuildingPinProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const tone =
    type === "hawker_centre"
      ? palette.orange
      : type === "food_court"
        ? palette.teal
        : type === "restaurant"
          ? palette.navy
          : palette.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Building pin for ${name}`}
      onPress={onPress}
      pointerEvents={onPress ? "auto" : "none"}
      style={({ pressed }) => [
        styles.container,
        selected ? shadows.floating : undefined,
        {
          backgroundColor: palette.surface,
          borderColor: selected ? tone : palette.border,
          borderRadius: radii.md,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: `${tone}22`,
            borderRadius: radii.pill,
          },
        ]}
      >
        <MapPin size={18} color={tone} fill={tone} />
      </View>
      <AppText variant="bodySmall" numberOfLines={1} style={{ maxWidth: 96 }}>
        {name}
      </AppText>
      <View
        style={[
          styles.typeMark,
          {
            backgroundColor: tone,
            borderRadius: radii.pill,
            marginTop: spacing[1],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 120,
  },
  iconWrap: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  typeMark: {
    height: 4,
    width: 28,
  },
});
