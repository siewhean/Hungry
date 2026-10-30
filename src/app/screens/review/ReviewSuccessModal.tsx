import { useEffect } from "react";
import { Modal, Pressable, View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import * as Haptics from "@/lib/haptics";

import { AppText, Badge, Button, Card } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { webShareUrl } from "@/constants/links";
import { shareLink } from "@/features/share/messagingShare";
import { reportError } from "@/lib/monitoring/reportError";
import { getServiceProvider } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

interface ReviewSuccessModalProps {
  onOpenHistory: () => void;
  /** Opens the posted review on its own page (live data only; mock reviews live on the dish). */
  onOpenReview?: (reviewId: string) => void;
}

export function ReviewSuccessModal({ onOpenHistory, onOpenReview }: ReviewSuccessModalProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const payload = useUIStore((state) => state.reviewSuccess);
  const hideReviewSuccess = useUIStore((state) => state.hideReviewSuccess);

  const canViewReview = Boolean(
    payload?.reviewId && onOpenReview && getServiceProvider().mode !== "mock",
  );

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
                  Thanks for sharing. It is now on {payload?.dishName ?? "this dish"}
                  {payload?.venueName ? ` · ${payload.venueName}` : ""}
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              accessibilityHint="Dismisses the review confirmation"
              onPress={hideReviewSuccess}
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                minWidth: 44,
              }}
            >
              <AppText variant="bodySmallBold" style={{ color: palette.orange }}>
                Done
              </AppText>
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

          {payload?.reviewId ? (
            <Button
              label="Share"
              onPress={() => {
                const reviewId = payload.reviewId;
                if (!reviewId) return;
                shareLink(
                  {
                    kind: "review",
                    id: reviewId,
                    message: `I reviewed ${payload.dishName}${payload.venueName ? ` at ${payload.venueName}` : ""} on Hungry`,
                    url: webShareUrl("review", reviewId),
                  },
                  "system_share",
                ).catch((error: unknown) =>
                  reportError(error, { screen: "ReviewSuccessModal", action: "share_review" }),
                );
              }}
            />
          ) : null}
          {canViewReview && payload?.reviewId && onOpenReview ? (
            <Button
              label="View review"
              variant="secondary"
              onPress={() => {
                const reviewId = payload.reviewId;
                hideReviewSuccess();
                if (reviewId) onOpenReview(reviewId);
              }}
            />
          ) : null}
          {canViewReview ? null : (
            // Without a review page (mock data) the history is the one place to see it.
            <Button
              label="Open review history"
              variant="secondary"
              onPress={() => {
                hideReviewSuccess();
                onOpenHistory();
              }}
            />
          )}
        </Card>
      </View>
    </Modal>
  );
}
