import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TriedOnSymbol } from "@/components/dish/dishSymbols";
import { ChevronRightSymbol } from "@/components/stall/stallSymbols";
import { AppText, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** A dish the sheet offers. Plain data, so it can travel as a navigation param. */
export type VisitedSheetDish = { id: string; name: string; priceLabel: string };

type Props = {
  stallName: string;
  /** The dishes to offer, already picked (see pickVisitedSheetDishes). */
  dishes: readonly VisitedSheetDish[];
  /** A dish was picked: the review starts with it. */
  onPickDish: (dish: VisitedSheetDish) => void;
  /** No dish fits (an empty menu, or all done): the review starts without one. */
  onWriteReview: () => void;
  onSkip: () => void;
};

/**
 * What the "What did you have?" sheet shows, after a stall is marked visited: the visit is
 * already saved, this only offers to say what the diner had. The system sheet around it
 * (grabber, swipe to dismiss, detents) is the route's formSheet presentation. Skipping costs
 * nothing and nothing here is required.
 */
export function StallVisitedSheet({ stallName, dishes, onPickDish, onWriteReview, onSkip }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const hasDishes = dishes.length > 0;

  return (
    <View
      testID="stall-visited-sheet"
      style={{ backgroundColor: palette.surface, flex: 1, paddingBottom: insets.bottom }}
    >
      <ScrollView
        contentContainerStyle={{ gap: spacing[4], padding: spacing[5] }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={{ alignItems: "center", gap: spacing[1] }}>
          <TriedOnSymbol color={palette.orange} size={32} />
          <AppText variant="h2" accessibilityRole="header" style={{ textAlign: "center" }}>
            {hasDishes ? "Visited. What did you have?" : "Visited"}
          </AppText>
          <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
            {hasDishes
              ? `Pick a dish at ${stallName} to rate it. Optional.`
              : `Saved to your visited stalls. Want to write the first review of ${stallName}?`}
          </AppText>
        </View>
        {hasDishes ? (
          <View style={{ gap: spacing[2] }}>
            {dishes.map((dish) => (
              <Pressable
                key={dish.id}
                accessibilityRole="button"
                accessibilityLabel={`Review ${dish.name}`}
                onPress={() => onPickDish(dish)}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: pressed ? palette.bgSoft : palette.surface,
                  borderColor: palette.border,
                  borderRadius: componentRadii.card,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: spacing[3],
                  minHeight: 56,
                  paddingHorizontal: spacing[4],
                })}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyBold" numberOfLines={2}>
                    {dish.name}
                  </AppText>
                  <AppText variant="price" tone="secondary">
                    {dish.priceLabel}
                  </AppText>
                </View>
                <ChevronRightSymbol color={palette.textMuted} size={18} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Button label="Write a review" variant="secondary" onPress={onWriteReview} />
        )}
        <Button label="Skip" variant="ghost" onPress={onSkip} />
      </ScrollView>
    </View>
  );
}
