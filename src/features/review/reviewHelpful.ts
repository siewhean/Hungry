import type { Review } from "@/types/domain";

export type ReviewHelpfulState = { helpful: boolean; count: number };

/** The helpful state the server (or mock) returned with the review. */
export function reviewHelpfulState(
  review: Pick<Review, "helpfulCount" | "viewerFoundHelpful">,
): ReviewHelpfulState {
  return { helpful: review.viewerFoundHelpful ?? false, count: review.helpfulCount ?? 0 };
}

/** Optimistic flip of the viewer's vote; the count never goes below zero. */
export function toggleReviewHelpful(state: ReviewHelpfulState): ReviewHelpfulState {
  return {
    helpful: !state.helpful,
    count: Math.max(0, state.count + (state.helpful ? -1 : 1)),
  };
}
