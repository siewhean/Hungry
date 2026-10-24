import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from "react-native";
import { Star } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

/** What each star count means, shown under the stars in the review editor. */
export const STAR_DESCRIPTORS = ["Not good", "Could be better", "Okay", "Good", "Amazing"] as const;

interface StarRatingProps {
  value: number;
  max?: number;
  editable?: boolean;
  onChange?: (value: number) => void;
  fullWidth?: boolean;
  /** Names the chosen rating ("Good", "Amazing") under the stars. */
  showDescriptor?: boolean;
}

export function StarRating({
  value,
  max = 5,
  editable = false,
  onChange,
  fullWidth = false,
  showDescriptor = false,
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

  const descriptor =
    showDescriptor && max === STAR_DESCRIPTORS.length && value >= 1
      ? STAR_DESCRIPTORS[Math.min(value, max) - 1]
      : undefined;

  const stars = (
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
                color={active ? palette.starStroke : palette.border}
                fill={active ? palette.starFill : "transparent"}
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
              color={active ? palette.starStroke : palette.border}
              fill={active ? palette.starFill : "transparent"}
            />
          </Pressable>
        );
      })}
    </View>
  );

  if (!showDescriptor) return stars;
  return (
    <View>
      {stars}
      {/* The row's own label already says the number; this names it for sighted readers. */}
      <AppText
        variant="bodySmall"
        tone="secondary"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {descriptor ?? "Tap a star to rate"}
      </AppText>
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
