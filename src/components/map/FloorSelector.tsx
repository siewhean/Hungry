import { ScrollView, Pressable, StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

export interface FloorSelectorProps {
  floors: string[];
  selectedFloor?: string;
  onSelectFloor?: (floor: string) => void;
  activeFloor?: string;
  onFloorChange?: (floor: string) => void;
}

export function FloorSelector({
  floors,
  selectedFloor,
  onSelectFloor,
  activeFloor,
  onFloorChange,
}: FloorSelectorProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const currentFloor = activeFloor ?? selectedFloor ?? "";
  const handleChange = onFloorChange ?? onSelectFloor;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing[2] }}
    >
      {floors.map((floor) => {
        const selected = floor === currentFloor;

        return (
          <Pressable
            key={floor}
            accessibilityRole="button"
            accessibilityLabel={`Select floor ${floor}`}
            accessibilityState={{ selected }}
            onPress={() => handleChange?.(floor)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: selected ? palette.orangeLight : palette.bgMuted,
                borderColor: selected ? palette.orange : palette.border,
                borderRadius: radii.pill,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <AppText tone={selected ? "accent" : "secondary"}>{floor}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tab: {
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
