import { Pressable } from "react-native";

import { EllipsisSymbol } from "@/components/dish/dishSymbols";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { selectHaptic } from "@/lib/haptics";
import { promptReviewSafetyActions } from "@/lib/security/communitySafety";
import type { PendingRoute } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";

type Props = {
  review: Pick<Review, "id" | "authorId" | "authorName">;
  /** Where a guest returns to after signing in to report or block. */
  returnRoute: PendingRoute;
  /** Called after a report or block succeeds, so the page drops the review. */
  onRemoved: () => void;
};

/**
 * The visible "⋯" on someone else's review, on dish and stall pages alike: Report or block.
 * (Holding the like heart still opens the same sheet, but a report control has to be seen.)
 */
export function ReviewMoreButton({ review, returnRoute, onRemoved }: Props) {
  const { palette } = useHungryTheme();
  const requireAccount = useRequireAccount();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Report or block, review by ${review.authorName}`}
      hitSlop={8}
      onPress={() => {
        if (!requireAccount("Sign in to report or block.", returnRoute)) return;
        selectHaptic();
        promptReviewSafetyActions({
          reviewId: review.id,
          authorName: review.authorName,
          authorId: review.authorId,
          onHidden: onRemoved,
          onBlocked: onRemoved,
        });
      }}
      style={{ alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44 }}
    >
      <EllipsisSymbol color={palette.textSecondary} size={20} />
    </Pressable>
  );
}
