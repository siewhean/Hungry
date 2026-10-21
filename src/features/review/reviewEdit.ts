import { REVIEW_TEXT_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import type { UpdateReviewInput } from "@/lib/services/types";

/**
 * Cleans an author's review edit the same way the composer cleans a new review.
 * Throws on an empty edit or a rating outside 1-5 (the reviews check constraint).
 */
export function normalizeReviewPatch(patch: UpdateReviewInput): UpdateReviewInput {
  const normalized: UpdateReviewInput = {};
  if (patch.rating !== undefined) {
    if (!Number.isInteger(patch.rating) || patch.rating < 1 || patch.rating > 5) {
      throw new Error("Choose a rating from 1 to 5 stars.");
    }
    normalized.rating = patch.rating;
  }
  if (patch.text !== undefined) {
    normalized.text = sanitizeFreeText(patch.text, REVIEW_TEXT_MAX_LENGTH);
  }
  if (patch.tags !== undefined) {
    normalized.tags = Array.from(
      new Set(patch.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    );
  }
  if (patch.wouldRecommend !== undefined) {
    normalized.wouldRecommend = patch.wouldRecommend;
  }
  if (Object.keys(normalized).length === 0) {
    throw new Error("Nothing to update.");
  }
  return normalized;
}

/** True when the signed-in user wrote this review (the edit/delete entry is shown). */
export function isOwnReview(review: { authorId?: string }, viewerId: string | undefined): boolean {
  return Boolean(viewerId && review.authorId && review.authorId === viewerId);
}
