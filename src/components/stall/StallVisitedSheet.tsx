import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { CheckCircle, ChevronRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button } from "@/components/ui";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type Props = {
  visible: boolean;
  stallName: string;
  /** The dishes to offer, already picked (see pickVisitedSheetDishes). */
  dishes: readonly DishDetail[];
  /** A dish was picked: the review starts with it. */
  onPickDish: (dish: DishDetail) => void;
  /** No dish fits (an empty menu, or all done): the review starts without one. */
  onWriteReview: () => void;
  onSkip: () => void;
};

/**
 * Shown in place after "Mark visited": the visit is already saved, this only offers to say
 * what the diner had. Skipping costs nothing and nothing here is required.
 */
export function StallVisitedSheet({
  visible,
  stallName,
  dishes,
  onPickDish,
  onWriteReview,
  onSkip,
}: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const hasDishes = dishes.length > 0;

  // Mounted only while open: nothing of it is left to focus or announce once it closes.
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onSkip}>
      <View style={{ backgroundColor: palette.mediaScrim, flex: 1, justifyContent: "flex-end" }}>
        {/* A tap on the dimmed page above the sheet is Skip. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onSkip}
          style={{ flex: 1 }}
        />
        <View
          accessibilityViewIsModal
          testID="stall-visited-sheet"
          style={{
            backgroundColor: palette.surface,
            borderTopLeftRadius: componentRadii.card,
            borderTopRightRadius: componentRadii.card,
            maxHeight: height * 0.85,
            paddingBottom: Math.max(insets.bottom, spacing[4]),
          }}
        >
          <ScrollView contentContainerStyle={{ gap: spacing[4], padding: spacing[5] }}>
            <View style={{ alignItems: "center", gap: spacing[1] }}>
              <CheckCircle color={palette.orange} size={32} />
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
                      <AppText variant="micro" tone="secondary">
                        {formatDishPrice(dish)}
                      </AppText>
                    </View>
                    <ChevronRight color={palette.textMuted} size={18} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Button label="Write a review" onPress={onWriteReview} />
            )}
            <Button label="Skip" variant="ghost" onPress={onSkip} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
