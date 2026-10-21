import { useState } from "react";
import { Pressable, View } from "react-native";
import { MoreHorizontal, ThumbsUp } from "lucide-react-native";

import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { reviewHelpfulState, toggleReviewHelpful } from "@/features/review/reviewHelpful";
import { promptReviewSafetyActions } from "@/lib/security/communitySafety";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { PendingRoute } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";
import { AppText } from "../ui";

interface ReviewReaderActionsProps {
  review: Pick<Review, "id" | "authorId" | "authorName" | "helpfulCount" | "viewerFoundHelpful">;
  /** The viewer wrote this review: they edit it instead (OwnReviewActions). */
  isOwn: boolean;
  /** Where a guest returns to after signing in to vote. */
  returnRoute: PendingRoute;
  /** Called after a report or block succeeds, so the page drops the review. */
  onRemoved: () => void;
}

/** Helpful vote plus Report / Block for someone else's review on a stall or dish page. */
export function ReviewReaderActions({
  review,
  isOwn,
  returnRoute,
  onRemoved,
}: ReviewReaderActionsProps) {
  const { palette, spacing } = useHungryTheme();
  const requireAccount = useRequireAccount();
  const showToast = useUIStore((state) => state.showToast);
  const [helpful, setHelpful] = useState(() => reviewHelpfulState(review));

  if (isOwn) return null;

  const onHelpfulPress = () => {
    if (!requireAccount("Sign in to mark reviews helpful.", returnRoute)) return;
    const previous = helpful;
    const next = toggleReviewHelpful(previous);
    setHelpful(next);
    getHungryService()
      .reviews.setReviewHelpful(review.id, next.helpful)
      .catch(() => {
        setHelpful(previous);
        showToast({ message: "Could not save your helpful vote.", tone: "warning" });
      });
  };

  const onMorePress = () => {
    if (!requireAccount("Sign in to report or block.", returnRoute)) return;
    promptReviewSafetyActions({
      reviewId: review.id,
      authorName: review.authorName,
      authorId: review.authorId,
      onHidden: onRemoved,
      onBlocked: onRemoved,
    });
  };

  const color = helpful.helpful ? palette.orange : palette.textSecondary;

  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing[2],
        justifyContent: "space-between",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          helpful.count === 1
            ? "Helpful, 1 person found this helpful"
            : `Helpful, ${helpful.count} people found this helpful`
        }
        accessibilityState={{ selected: helpful.helpful }}
        onPress={onHelpfulPress}
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[1],
          minHeight: 44,
        }}
      >
        <ThumbsUp color={color} fill={helpful.helpful ? palette.orange : "transparent"} size={18} />
        <AppText variant="bodySmall" style={{ color, fontWeight: "600" }}>
          {helpful.count > 0 ? `Helpful · ${helpful.count}` : "Helpful"}
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More options for ${review.authorName}'s review`}
        accessibilityHint="Report this review or block its author"
        onPress={onMorePress}
        style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
      >
        <MoreHorizontal color={palette.textMuted} size={20} />
      </Pressable>
    </View>
  );
}
