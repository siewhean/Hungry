import { Pressable, StyleSheet, View } from "react-native";
import { Star } from "lucide-react-native";

import { useHungryTheme } from "@/theme";

interface StarRatingProps {
  value: number;
  max?: number;
  editable?: boolean;
  onChange?: (value: number) => void;
}

export function StarRating({ value, max = 5, editable = false, onChange }: StarRatingProps) {
  const { palette } = useHungryTheme();

  return (
    <View style={styles.row}>
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
    gap: 4,
  },
  hitArea: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
