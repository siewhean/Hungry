import { Pressable, View } from "react-native";

import { TASTE_DIMENSIONS } from "@/constants/taste";
import { useHungryTheme } from "@/theme";
import type { TasteKey } from "@/types/domain";
import { AppText } from "../ui";

/** Five steps on the 0-10 taste scale, named for the reviewer. */
export const TASTE_RATING_LEVELS = [
  { value: 0, label: "None" },
  { value: 2.5, label: "Light" },
  { value: 5, label: "Medium" },
  { value: 7.5, label: "Strong" },
  { value: 10, label: "Very" },
] as const;

/** The step closest to a 0-10 level. */
export function nearestTasteRatingLevel(level: number): number {
  return TASTE_RATING_LEVELS.reduce((best, step) =>
    Math.abs(step.value - level) < Math.abs(best.value - level) ? step : best,
  ).value;
}

type Props = {
  /** Levels the reviewer picked. */
  values: Partial<Record<TasteKey, number>>;
  /** Our guess for each axis (the dish's level as this reviewer is likely to feel it). */
  suggestions?: Partial<Record<TasteKey, number>>;
  /** undefined clears the axis. */
  onChange: (key: TasteKey, value: number | undefined) => void;
};

/**
 * Optional "How did it taste?" rows in the review editor: one row of five steps per taste.
 * A suggested step shows as a soft ring until the reviewer taps; tapping the picked step clears it.
 */
export function TasteRatingInput({ values, suggestions, onChange }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <View style={{ gap: spacing[1] }}>
      {/* Step names once, above the columns of dots. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: "row" }}
      >
        <View style={{ width: LABEL_COLUMN }} />
        <View style={{ flex: 1, flexDirection: "row" }}>
          {TASTE_RATING_LEVELS.map((step) => (
            // Same flex column as the dots below, so names stay over their dots at 2x text.
            <AppText
              key={step.value}
              variant="micro"
              tone="muted"
              style={{ flex: 1, minWidth: STEP_MIN_WIDTH, textAlign: "center" }}
            >
              {step.label}
            </AppText>
          ))}
        </View>
      </View>
      {TASTE_DIMENSIONS.map((dimension) => {
        const picked = values[dimension.key];
        const suggested =
          picked === undefined && suggestions?.[dimension.key] !== undefined
            ? nearestTasteRatingLevel(suggestions[dimension.key] ?? 0)
            : undefined;
        return (
          <View key={dimension.key} style={{ alignItems: "center", flexDirection: "row" }}>
            <AppText
              variant="bodySmallBold"
              style={{ paddingRight: spacing[1], width: LABEL_COLUMN }}
            >
              {dimension.label}
            </AppText>
            {/* One radio group per taste, so a screen reader says "Spicy, 2 of 5". */}
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={dimension.label}
              style={{ flex: 1, flexDirection: "row" }}
            >
              {TASTE_RATING_LEVELS.map((step) => {
                const isPicked = picked === step.value;
                const isSuggested = suggested === step.value;
                return (
                  <Pressable
                    key={step.value}
                    accessibilityRole="radio"
                    accessibilityLabel={`${dimension.label}: ${step.label}${isSuggested ? ", suggested" : ""}`}
                    accessibilityState={{ checked: isPicked }}
                    onPress={() => onChange(dimension.key, isPicked ? undefined : step.value)}
                    hitSlop={{ left: 2, right: 2 }}
                    style={{
                      alignItems: "center",
                      flex: 1,
                      justifyContent: "center",
                      minHeight: 44,
                      minWidth: STEP_MIN_WIDTH,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: isPicked
                          ? palette.orange
                          : isSuggested
                            ? palette.orangeLight
                            : "transparent",
                        borderColor: isPicked || isSuggested ? palette.orange : palette.textMuted,
                        borderRadius: radii.pill,
                        borderStyle: isSuggested ? "dashed" : "solid",
                        borderWidth: 1.5,
                        height: 22,
                        width: 22,
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The taste names take a share of the row, not a fixed 84pt, so five 40pt+ steps (44pt with
 * their hit slop) still fit on a 320pt screen.
 */
const LABEL_COLUMN = "24%";
const STEP_MIN_WIDTH = 40;
