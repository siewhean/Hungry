import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Heart, Star } from "lucide-react-native";

import { useRequireAccount } from "@/features/auth/useRequireAccount";
import {
  createHelpfulVoteQueue,
  helpfulStateFor,
  reviewHelpfulState,
  toggleReviewHelpful,
} from "@/features/review/reviewHelpful";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { confirmHaptic, selectHaptic, tapHaptic } from "@/lib/haptics";
import { promptReviewSafetyActions } from "@/lib/security/communitySafety";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { PendingRoute } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";
import { AppText } from "../ui";

/**
 * One queue for every like button: a review's votes go to the server one at a time, so a
 * quick like then unlike can never land as delete-then-upsert (liked on the server, not on
 * screen).
 */
const submitHelpfulVote = createHelpfulVoteQueue((reviewId, helpful) =>
  getHungryService().reviews.setReviewHelpful(reviewId, helpful),
);

interface ReviewReaderActionsProps {
  review: Pick<Review, "id" | "authorId" | "authorName" | "helpfulCount" | "viewerFoundHelpful">;
  /** The viewer wrote this review: they edit it instead (OwnReviewActions). */
  isOwn: boolean;
  /** Where a guest returns to after signing in to like or report. */
  returnRoute: PendingRoute;
  /** Called after a report or block succeeds, so the page drops the review. */
  onRemoved: () => void;
  /** The review's stars, shown on the same line as the like, at the left. */
  rating?: number;
}

/**
 * The last line of a review card on a stall or dish page: the stars on the left and, on someone
 * else's review, a like (heart) on the right. Likes are stored as the review's helpful votes.
 * Holding the heart opens Report / Block.
 */
export function ReviewReaderActions({
  review,
  isOwn,
  returnRoute,
  onRemoved,
  rating,
}: ReviewReaderActionsProps) {
  const { palette, spacing } = useHungryTheme();
  const requireAccount = useRequireAccount();
  const showToast = useUIStore((state) => state.showToast);
  const [liked, setLiked] = useState(() => reviewHelpfulState(review));
  // The vote the server last confirmed, so a failure rolls back to it, not to the last tap.
  const [confirmed, setConfirmed] = useState(() => reviewHelpfulState(review));
  // A page refetch (ReviewDetail on focus) brings a newer count or vote: take it, unless a vote
  // of ours is still on its way, whose result would be overwritten.
  const pendingVotesRef = useRef(0);
  const loadedKey = `${review.helpfulCount ?? 0}:${review.viewerFoundHelpful ?? false}`;
  const [seededKey, setSeededKey] = useState(loadedKey);
  if (loadedKey !== seededKey) {
    setSeededKey(loadedKey);
    if (pendingVotesRef.current === 0) {
      const fresh = reviewHelpfulState(review);
      setLiked(fresh);
      setConfirmed(fresh);
    }
  }

  if (isOwn && rating === undefined) return null;

  const onLikePress = () => {
    if (!requireAccount("Sign in to like reviews.", returnRoute)) return;
    const previous = liked;
    const next = toggleReviewHelpful(previous);
    if (next.helpful) confirmHaptic();
    else tapHaptic();
    setLiked(next);
    trackAnalyticsEvent("review_helpful_toggled", { review_id: review.id, helpful: next.helpful });
    pendingVotesRef.current += 1;
    void submitHelpfulVote(review.id, next.helpful, previous.helpful, (serverHelpful) => {
      setLiked(helpfulStateFor(confirmed, serverHelpful));
      showToast({ message: "Could not save your like.", tone: "warning" });
    }).finally(() => {
      pendingVotesRef.current -= 1;
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
    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
      {rating !== undefined ? (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Rated ${rating} out of 5`}
          style={{ alignItems: "center", flexDirection: "row", gap: 2 }}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              size={14}
              color={index < rating ? palette.starStroke : palette.border}
              fill={index < rating ? palette.starFill : "transparent"}
            />
          ))}
        </View>
      ) : (
        <View />
      )}
      {isOwn ? null : (
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
      )}
    </View>
  );
}
