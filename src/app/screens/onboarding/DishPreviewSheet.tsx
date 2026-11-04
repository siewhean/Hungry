import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Heart } from "lucide-react-native";

import { AppText, Badge, Button } from "@/components/ui";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";
import { ResultDishPhoto } from "./ResultDishCard";

interface DishPreviewSheetProps {
  dish: DishDetail | null;
  distanceLabel?: string;
  isSaved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}

/**
 * A read-only look at a dish before the user has an account: photo, stall, price, distance and
 * taste tags. The pre-auth navigator has no dish page, so this is what a tap on a first pick
 * opens. Saving it keeps the dish for after sign-up.
 */
export function DishPreviewSheet({
  dish,
  distanceLabel,
  isSaved,
  onToggleSave,
  onClose,
}: DishPreviewSheetProps) {
  const { palette, radii, spacing } = useHungryTheme();
  if (!dish) return null;
  return (
    <Modal
      transparent
      visible
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: palette.overlay, justifyContent: "flex-end" },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close preview"
          accessibilityHint="Dismisses the dish preview"
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: palette.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            maxHeight: "85%",
            overflow: "hidden",
          }}
        >
          <ScrollView contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[4] }}>
            <ResultDishPhoto dish={dish} height={200} />
            <View style={{ gap: spacing[2], paddingHorizontal: spacing[4] }}>
              <AppText variant="h2" accessibilityRole="header">
                {dish.name}
              </AppText>
              <AppText variant="body" tone="secondary">
                {[dish.venueName, dish.unitNumber].filter(Boolean).join(" · ")}
              </AppText>
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing[2],
                }}
              >
                <AppText variant="bodyBold" style={{ fontVariant: ["tabular-nums"] }}>
                  {formatDishPrice(dish)}
                </AppText>
                {distanceLabel ? (
                  <AppText variant="bodySmall" tone="secondary">
                    {distanceLabel}
                  </AppText>
                ) : null}
              </View>
              {dish.tasteTags.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                  {dish.tasteTags.slice(0, 4).map((tag) => (
                    <Badge key={tag} label={tag} tone="neutral" />
                  ))}
                </View>
              ) : null}
              <AppText variant="bodySmall" tone="muted">
                Create your account to open the full dish page, reviews and directions.
              </AppText>
            </View>
          </ScrollView>
          <View style={{ gap: spacing[2], padding: spacing[4] }}>
            <Button
              label={isSaved ? "Saved for after sign-up" : "Save this dish"}
              variant={isSaved ? "secondary" : "primary"}
              leftIcon={
                <Heart
                  color={isSaved ? palette.orange : palette.surface}
                  fill={isSaved ? palette.orange : "transparent"}
                  size={16}
                />
              }
              onPress={onToggleSave}
            />
            <Button label="Close" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
