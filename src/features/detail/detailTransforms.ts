import type { RecentReviewFeedEntry } from "@/lib/services/types";
import type { DishDetail } from "@/types/domain";

export interface StallCommunityReview {
  id: string;
  /** The review row id (id is unique per dish row). */
  reviewId: string;
  dishId: string;
  dishName: string;
  authorId?: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
  /** The author's own photo; without one the Avatar falls back to the Hungry logo. */
  avatarUrl?: string;
  merchantReply?: { text: string; repliedAt: string };
  /** Signed review photo URLs. */
  photos: string[];
}

export const STALL_COMMUNITY_REVIEW_LIMIT = 6;

export function buildDishGallery(dish: DishDetail) {
  const ordered = [dish.imageUrl, ...dish.gallery];
  return ordered.filter((url, index) => Boolean(url) && ordered.indexOf(url) === index);
}

/** Newest reviews across a stall's dishes, each naming the dish it is about. */
export function deriveStallCommunityReviews(
  entries: RecentReviewFeedEntry[],
  limit = STALL_COMMUNITY_REVIEW_LIMIT,
): StallCommunityReview[] {
  return [...entries]
    .sort(
      (left, right) =>
        new Date(right.review.createdAt).getTime() - new Date(left.review.createdAt).getTime(),
    )
    .slice(0, limit)
    .map(
      ({ review, dishId, dishName }) =>
        ({
          id: `${dishId}-${review.id}`,
          reviewId: review.id,
          dishId,
          dishName,
          authorId: review.authorId,
          authorName: review.authorName,
          rating: review.rating,
          text: review.text,
          createdAt: review.createdAt,
          avatarUrl: review.authorAvatarUrl,
          merchantReply: review.merchantReply,
          photos: review.photos ?? [],
        }) satisfies StallCommunityReview,
    );
}
