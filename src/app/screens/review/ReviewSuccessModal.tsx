import { useEffect } from "react";
import { Modal, Pressable, View } from "react-native";
import { CheckCircle2, Sparkles, X } from "lucide-react-native";
import * as Haptics from "@/lib/haptics";

import { AppText, Badge, Button, Card } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

interface ReviewSuccessModalProps {
  onOpenHistory: () => void;
}

export function ReviewSuccessModal({ onOpenHistory }: ReviewSuccessModalProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const payload = useUIStore((state) => state.reviewSuccess);
  const hideReviewSuccess = useUIStore((state) => state.hideReviewSuccess);

  useEffect(() => {
    if (payload) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [payload]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(payload)}
      onRequestClose={hideReviewSuccess}
      accessibilityViewIsModal
    >
      <View
        accessibilityViewIsModal
        style={{
          flex: 1,
          backgroundColor: palette.overlay,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing[5],
        }}
      >
        <Card style={{ width: "100%", gap: spacing[4], padding: spacing[5] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], flex: 1 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.successSoft,
                }}
              >
                <CheckCircle2 color={palette.success} size={28} />
              </View>
              <View style={{ flex: 1, gap: spacing[1] }}>
                <AppText variant="h3">Review posted</AppText>
                <AppText tone="secondary">
                  {payload?.dishName ?? "Dish review"} · {payload?.venueName ?? "Nearby stall"}
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close review success"
              accessibilityHint="Dismisses the review confirmation"
              onPress={hideReviewSuccess}
              style={{
                width: 44,
                height: 44,
                borderRadius: componentRadii.iconButton,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: palette.bgMuted,
              }}
            >
              <X color={palette.text} size={18} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            <Badge label={`${payload?.rating ?? 0}/5 rating`} tone="orange" />
            {payload?.tagCount ? (
              <Badge label={`${payload.tagCount} taste tags`} tone="amber" />
            ) : null}
            {/* Points exist only where gamification is on; never show a made-up score. */}
            {FEATURE_FLAGS.gamificationEnabled && payload?.pointsEarned ? (
              <Badge label={`+${payload.pointsEarned} points`} tone="success" />
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <Sparkles color={palette.orange} size={16} />
            <AppText variant="bodySmall" tone="secondary">
              Profile updated. Your review has been added to your history.
            </AppText>
          </View>

          <Button
            label="Open review history"
            onPress={() => {
              hideReviewSuccess();
              onOpenHistory();
            }}
          />
          <Button label="Keep exploring" variant="secondary" onPress={hideReviewSuccess} />
        </Card>
      </View>
    </Modal>
  );
}
