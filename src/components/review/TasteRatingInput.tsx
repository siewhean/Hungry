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
        <View style={{ width: LABEL_WIDTH }} />
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between" }}>
          {TASTE_RATING_LEVELS.map((step) => (
            <AppText
              key={step.value}
              variant="micro"
              tone="muted"
              style={{ minWidth: 44, textAlign: "center" }}
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
            <AppText variant="bodySmallBold" style={{ width: LABEL_WIDTH }}>
              {dimension.label}
            </AppText>
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between" }}>
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
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 44,
                      minWidth: 44,
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

const LABEL_WIDTH = 84;
