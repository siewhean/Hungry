import { useState } from "react";
import { Pressable, View } from "react-native";
import { Heart } from "lucide-react-native";

import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { reviewHelpfulState, toggleReviewHelpful } from "@/features/review/reviewHelpful";
import { confirmHaptic, selectHaptic, tapHaptic } from "@/lib/haptics";
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
  /** Where a guest returns to after signing in to like or report. */
  returnRoute: PendingRoute;
  /** Called after a report or block succeeds, so the page drops the review. */
  onRemoved: () => void;
}

/**
 * A like (heart) at the right edge of someone else's review on a stall or dish page. Likes are
 * stored as the review's helpful votes. Holding the heart opens Report / Block.
 */
export function ReviewReaderActions({
  review,
  isOwn,
  returnRoute,
  onRemoved,
}: ReviewReaderActionsProps) {
  const { palette, spacing } = useHungryTheme();
  const requireAccount = useRequireAccount();
  const showToast = useUIStore((state) => state.showToast);
  const [liked, setLiked] = useState(() => reviewHelpfulState(review));

  if (isOwn) return null;

  const onLikePress = () => {
    if (!requireAccount("Sign in to like reviews.", returnRoute)) return;
    const previous = liked;
    const next = toggleReviewHelpful(previous);
    if (next.helpful) confirmHaptic();
    else tapHaptic();
    setLiked(next);
    getHungryService()
      .reviews.setReviewHelpful(review.id, next.helpful)
      .catch(() => {
        setLiked(previous);
        showToast({ message: "Could not save your like.", tone: "warning" });
      });
  };

  const openSafetyActions = () => {
    if (!requireAccount("Sign in to report or block.", returnRoute)) return;
    selectHaptic();
    promptReviewSafetyActions({
      reviewId: review.id,
      authorName: review.authorName,
      authorId: review.authorId,
      onHidden: onRemoved,
      onBlocked: onRemoved,
    });
  };

  const color = liked.helpful ? palette.orange : palette.textSecondary;

  return (
    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "flex-end" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={liked.count === 1 ? "Like, 1 like" : `Like, ${liked.count} likes`}
        accessibilityHint="Hold to report this review or block its author"
        accessibilityState={{ selected: liked.helpful }}
        accessibilityActions={[{ name: "longpress", label: "Report or block" }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "longpress") openSafetyActions();
        }}
        delayLongPress={320}
        onLongPress={openSafetyActions}
        onPress={onLikePress}
        hitSlop={4}
        style={({ pressed }) => ({
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[1],
          justifyContent: "center",
          minHeight: 44,
          minWidth: 44,
          transform: [{ scale: pressed ? 0.88 : 1 }],
        })}
      >
        <Heart color={color} fill={liked.helpful ? palette.orange : "transparent"} size={20} />
        {liked.count > 0 ? (
          <AppText variant="bodySmall" style={{ color, fontWeight: "600" }}>
            {liked.count}
          </AppText>
        ) : null}
      </Pressable>
    </View>
  );
}
