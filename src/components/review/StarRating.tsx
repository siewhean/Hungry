import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from "react-native";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import { AppSymbol, AppText } from "../ui";

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
  /** Centres the stars and the line under them (the review editor). */
  centered?: boolean;
}

export function StarRating({
  value,
  max = 5,
  editable = false,
  onChange,
  fullWidth = false,
  showDescriptor = false,
  centered = false,
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
      style={[
        styles.row,
        fullWidth && { justifyContent: "space-between" },
        centered && { alignSelf: "center" },
      ]}
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
              <ReviewStar
                size={24}
                active={active}
                color={active ? palette.starFill : palette.textMuted}
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
            onPress={() => {
              if (starValue !== value) selectHaptic();
              onChange?.(starValue);
            }}
            hitSlop={8}
            style={styles.hitArea}
          >
            <ReviewStar
              size={STAR_ICON_SIZE}
              active={active}
              color={active ? palette.starFill : palette.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );

  if (!showDescriptor) return stars;
  return (
    <View style={centered ? { alignItems: "center" } : undefined}>
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

/** One star: the filled SF Symbol when chosen, the outline when not. */
function ReviewStar({ size, active, color }: { size: number; active: boolean; color: string }) {
  return <AppSymbol name={active ? "rating" : "ratingEmpty"} size={size} color={color} />;
}

/** Star icon size; each star's tap area is at least 44pt wide and tall, plus 8pt of slop. */
const STAR_ICON_SIZE = 28;

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
