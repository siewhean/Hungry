import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { TriedOnSymbol } from "@/components/dish/dishSymbols";
import { ChevronRightSymbol } from "@/components/stall/stallSymbols";
import { AppText, Button, DismissibleSheet } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** A dish the sheet offers. */
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
  /** The menu is still being read: the dishes (or the review button) follow. */
  loading?: boolean;
};

/**
 * What the "What did you have?" sheet shows, after a stall is marked visited: the visit is
 * already saved, this only offers to say what the diner had. The sheet around it is the app's own
 * DismissibleSheet (grabber, swipe down or tap outside to dismiss) over a transparent route: the
 * system formSheet it replaced came up empty on iOS. Skipping costs nothing and nothing here is
 * required.
 */
export function StallVisitedSheet({
  stallName,
  dishes,
  onPickDish,
  onWriteReview,
  onSkip,
  loading = false,
}: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const hasDishes = !loading && dishes.length > 0;

  return (
    <DismissibleSheet
      visible
      onClose={onSkip}
      closeLabel="Close"
      maxHeightRatio={0.85}
      header={
        <View style={{ alignItems: "center", gap: spacing[1], padding: spacing[5] }}>
          <TriedOnSymbol color={palette.orange} size={32} />
          <AppText variant="h2" accessibilityRole="header" style={{ textAlign: "center" }}>
            {hasDishes ? "Visited. What did you have?" : "Visited"}
          </AppText>
          <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
            {hasDishes
              ? `Pick a dish at ${stallName} to rate it. Optional.`
              : loading
                ? "Saved to your visited stalls."
                : `Saved to your visited stalls. Want to write the first review of ${stallName}?`}
          </AppText>
        </View>
      }
    >
      <ScrollView
        testID="stall-visited-sheet"
        contentContainerStyle={{
          gap: spacing[3],
          paddingBottom: spacing[3],
          paddingHorizontal: spacing[5],
        }}
      >
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading dishes" color={palette.orange} />
        ) : hasDishes ? (
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
    </DismissibleSheet>
  );
}
