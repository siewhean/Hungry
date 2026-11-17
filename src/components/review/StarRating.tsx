import { Pressable, StyleSheet, View } from "react-native";
import { Star } from "lucide-react-native";

import { useHungryTheme } from "@/theme";

interface StarRatingProps {
  value: number;
  max?: number;
  editable?: boolean;
  onChange?: (value: number) => void;
  fullWidth?: boolean;
}

export function StarRating({
  value,
  max = 5,
  editable = false,
  onChange,
  fullWidth = false,
}: StarRatingProps) {
  const { palette } = useHungryTheme();

  return (
    <View
      style={[styles.row, fullWidth && { justifyContent: "space-between" }]}
      accessibilityLabel={editable ? "Rating out of 5 stars" : `${value} out of ${max} stars`}
      accessibilityRole={editable ? "adjustable" : "none"}
      accessibilityValue={{ min: 0, max, now: value }}
      accessibilityActions={editable ? [{ name: "increment" }, { name: "decrement" }] : undefined}
      onAccessibilityAction={(event) => {
        if (!editable) return;
        if (event.nativeEvent.actionName === "increment") onChange?.(Math.min(max, value + 1));
        if (event.nativeEvent.actionName === "decrement") onChange?.(Math.max(1, value - 1));
      }}
    >
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        const active = starValue <= value;

        if (!editable) {
          return (
            <View key={starValue} style={styles.hitArea} accessibilityLabel={`${starValue} star`}>
              <Star
                size={24}
                color={active ? palette.amber : palette.border}
                fill={active ? palette.amber : "transparent"}
              />
            </View>
          );
        }

        return (
          <Pressable
            key={starValue}
            accessibilityRole="button"
            accessibilityLabel={`${starValue} star`}
            accessibilityState={{ selected: value === starValue }}
            onPress={() => onChange?.(starValue)}
            hitSlop={8}
            style={styles.hitArea}
          >
            <Star
              size={24}
              color={active ? palette.amber : palette.border}
              fill={active ? palette.amber : "transparent"}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 1,
  },
  hitArea: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
