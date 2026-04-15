import { ScrollView, Pressable, StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface FloorSelectorProps {
  floors: string[];
  selectedFloor: string;
  onSelectFloor: (floor: string) => void;
}

export function FloorSelector({ floors, selectedFloor, onSelectFloor }: FloorSelectorProps) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
      {floors.map((floor) => {
        const selected = floor === selectedFloor;

        return (
          <Pressable
            key={floor}
            accessibilityRole="button"
            accessibilityLabel={`Select floor ${floor}`}
            accessibilityState={{ selected }}
            onPress={() => onSelectFloor(floor)}
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
