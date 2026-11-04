import { useMemo, type Dispatch, type SetStateAction } from "react";

import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { withoutRemovedReview } from "@/features/detail/dishPage";
import { getBlockedAuthorIdsForSession } from "@/lib/security/communitySafety";
import type { PendingRoute } from "@/store/useSessionStore";
import type { Review } from "@/types/domain";

type Navigation = Pick<NativeStackNavigationProp<RootStackParamList>, "navigate">;

/**
 * What a review card on a dish list does to the list: open the author, drop a reported or
 * blocked review (and a blocked author's others), apply an edit, remove a deletion. Shared by
 * the dish page's preview and the full reviews screen so the two cannot drift.
 */
export function useDishReviewActions({
  dishId,
  navigation,
  setReviews,
  onOwnReviewChanged,
}: {
  dishId: string;
  navigation: Navigation;
  setReviews: Dispatch<SetStateAction<Review[]>>;
  /** The diner's own review was edited or deleted: the dish's rating and count have changed. */
  onOwnReviewChanged?: () => void;
}) {
  return useMemo(() => {
    const returnRoute: PendingRoute = { name: "DishDetail", params: { dishId } };
    return {
      returnRoute,
      openAuthor: (review: Review) => {
        if (!review.authorId) return;
        navigation.navigate("UserProfile", {
          authorId: review.authorId,
          authorName: review.authorName,
          authorAvatarUrl: review.authorAvatarUrl,
        });
      },
      removeReview: (reviewId: string) =>
        setReviews((current) =>
          withoutRemovedReview(current, reviewId, getBlockedAuthorIdsForSession()),
        ),
      updateReview: (reviewId: string, patch: Partial<Review>) => {
        setReviews((current) =>
          current.map((entry) => (entry.id === reviewId ? { ...entry, ...patch } : entry)),
        );
        onOwnReviewChanged?.();
      },
      deleteReview: (reviewId: string) => {
        setReviews((current) => current.filter((entry) => entry.id !== reviewId));
        onOwnReviewChanged?.();
      },
    };
  }, [dishId, navigation, onOwnReviewChanged, setReviews]);
}
