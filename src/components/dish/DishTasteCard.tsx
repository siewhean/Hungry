import { Pressable, View, useWindowDimensions } from "react-native";

import { TasteRadarChart } from "@/components/taste/TasteRadarChart";
import { AppText } from "@/components/ui";
import { blendDinerTaste, type DinerTaste } from "@/features/detail/dishTasteSummary";
import {
  perceivedTasteAxes,
  perceivedTasteRows,
  perceivedTasteSentence,
} from "@/features/detail/perceivedTaste";
import { useHungryTheme } from "@/theme";
import type { TasteVector } from "@/types/domain";

const ZERO_VECTOR: TasteVector = { sweet: 0, spicy: 0, sour: 0, salty: 0, rich: 0, aromatic: 0 };

type Props = {
  /** The catalog estimate. Shown as the dashed shape only when `hasEstimate`. */
  dishVector: TasteVector;
  hasEstimate: boolean;
  /** The diner's own palette; undefined until they have taken the quiz. */
  palate?: TasteVector;
  /** Averages from diners who rated the taste, once 3+ did on an axis. */
  diners?: DinerTaste;
  onTakeQuiz: () => void;
};

/**
 * "How it tastes" on the dish page. The heading says "to you" only when a palate makes it
 * true; without one the quiz line is a button, not a sentence about another screen.
 */
export function DishTasteCard({ dishVector, hasEstimate, palate, diners, onTakeQuiz }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  // Where diners rated, their average is the dish's standard level; the estimate fills the rest.
  // With no usable estimate the placeholder vector is never shown as fact: axes diners did not
  // rate sit at 0.
  const estimate: TasteVector = hasEstimate ? dishVector : ZERO_VECTOR;
  const standardVector = blendDinerTaste(estimate, diners);
  const axes = perceivedTasteAxes(standardVector, palate).map((axis) => ({
    ...axis,
    // The dashed shape keeps the catalog estimate; the solid one is what diners said.
    standard: estimate[axis.key] ?? 0,
    ...(diners?.levels[axis.key] !== undefined ? { diners: diners.levels[axis.key] } : {}),
  }));
  const rows = perceivedTasteRows(standardVector, palate);

  return (
    <View style={{ gap: spacing[3] }}>
      <AppText variant="h2">{palate ? "How it tastes to you" : "How it tastes"}</AppText>
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          gap: spacing[4],
          padding: spacing[4],
        }}
      >
        <TasteRadarChart
          axes={axes}
          dinerCount={diners?.raters}
          showEstimate={hasEstimate}
          size={Math.min(width - spacing[4] * 4, 300)}
        />
        {palate ? (
          rows
            .filter((row) => row.direction !== "same")
            .slice(0, 2)
            .map((row) => (
              <AppText key={row.key} variant="bodySmall" tone="secondary">
                {perceivedTasteSentence(row)}
              </AppText>
            ))
        ) : (
          <View style={{ alignItems: "center", gap: spacing[0.5] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take the taste quiz"
              accessibilityHint="See how it tastes to you"
              onPress={onTakeQuiz}
              style={{ alignItems: "center", minHeight: 44, justifyContent: "center" }}
            >
              <AppText variant="bodySmallBold" tone="accent" style={{ textAlign: "center" }}>
                Take the taste quiz
              </AppText>
            </Pressable>
            <AppText variant="micro" tone="muted" style={{ textAlign: "center" }}>
              See how it tastes to you
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
