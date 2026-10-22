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

/** The vote state to show once the server has confirmed `helpful`, starting from the loaded `base`. */
export function helpfulStateFor(base: ReviewHelpfulState, helpful: boolean): ReviewHelpfulState {
  return helpful === base.helpful ? base : toggleReviewHelpful(base);
}

/**
 * Sends helpful votes one at a time per review. Rapid taps only update the wanted state; the
 * request in flight finishes first and one follow-up carries the final state, so requests can
 * never arrive out of order. On failure `onFailed` gets the last state the server confirmed.
 */
export function createHelpfulVoteQueue(
  send: (reviewId: string, helpful: boolean) => Promise<unknown>,
) {
  const entries = new Map<string, { wanted: boolean; confirmed: boolean }>();

  return async function submitHelpfulVote(
    reviewId: string,
    wanted: boolean,
    confirmedBefore: boolean,
    onFailed: (confirmed: boolean) => void,
  ): Promise<void> {
    const existing = entries.get(reviewId);
    if (existing) {
      existing.wanted = wanted;
      return;
    }
    const entry = { wanted, confirmed: confirmedBefore };
    entries.set(reviewId, entry);
    try {
      while (entry.confirmed !== entry.wanted) {
        const target = entry.wanted;
        await send(reviewId, target);
        entry.confirmed = target;
      }
    } catch {
      onFailed(entry.confirmed);
    } finally {
      entries.delete(reviewId);
    }
  };
}
