import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from "react-native";
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

  // One accessible element: screen readers swipe up/down to adjust instead of
  // visiting five separate stars.
  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") {
      onChange?.(Math.min(max, value + 1));
    } else if (event.nativeEvent.actionName === "decrement") {
      onChange?.(Math.max(1, value - 1));
    }
  };

  return (
    <View
      style={[styles.row, fullWidth && { justifyContent: "space-between" }]}
      accessible
      accessibilityLabel={
        editable
          ? `Rating, ${value > 0 ? `${value} of ${max}` : "not rated"}`
          : `${value} out of ${max} stars`
      }
      accessibilityRole={editable ? "adjustable" : "image"}
      accessibilityValue={editable ? { min: 0, max, now: value } : undefined}
      accessibilityActions={editable ? [{ name: "increment" }, { name: "decrement" }] : undefined}
      onAccessibilityAction={editable ? handleAccessibilityAction : undefined}
    >
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        const active = starValue <= value;

        if (!editable) {
          return (
            <View
              key={starValue}
              style={styles.hitArea}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
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
            testID={`star-${starValue}`}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
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
