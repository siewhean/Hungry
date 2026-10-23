import { Pressable, View } from "react-native";
import { MoreHorizontal } from "lucide-react-native";

import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { promptReviewSafetyActions } from "@/lib/security/communitySafety";
import type { PendingRoute } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";

interface ReviewReaderActionsProps {
  review: Pick<Review, "id" | "authorId" | "authorName" | "helpfulCount" | "viewerFoundHelpful">;
  /** The viewer wrote this review: they edit it instead (OwnReviewActions). */
  isOwn: boolean;
  /** Where a guest returns to after signing in to report. */
  returnRoute: PendingRoute;
  /** Called after a report or block succeeds, so the page drops the review. */
  onRemoved: () => void;
}

/** Report / Block for someone else's review on a stall or dish page, at the card's right edge. */
export function ReviewReaderActions({
  review,
  isOwn,
  returnRoute,
  onRemoved,
}: ReviewReaderActionsProps) {
  const { palette } = useHungryTheme();
  const requireAccount = useRequireAccount();
  if (isOwn) return null;

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

  return (
    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "flex-end" }}>
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
