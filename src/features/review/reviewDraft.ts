import type { ReviewDraft } from "../../types/domain";

export function createInitialReviewDraft(): ReviewDraft {
  return {
    selectedVenueId: undefined,
    selectedDishId: undefined,
    rating: 0,
    selectedTags: [],
    // Unanswered until the reviewer picks Yes or No.
    recommend: null,
    text: "",
    photos: [],
  };
}

/**
 * True when the draft holds anything worth asking about, with or without a dish: a rating, text,
 * a photo, a picked tag or a Yes/No on recommending.
 */
export function reviewDraftHasContent(draft: ReviewDraft): boolean {
  return (
    draft.rating > 0 ||
    draft.text.trim().length > 0 ||
    draft.photos.length > 0 ||
    draft.selectedTags.length > 0 ||
    typeof draft.recommend === "boolean" ||
    Boolean(draft.videoUri)
  );
}

export type ReviewRequiredField = "dish" | "photo" | "rating";

/**
 * The first required field still missing, in the order the editor shows them (dish, photo,
 * rating), with the sentence shown under Publish; null when the review can be published.
 */
export function firstMissingReviewField(
  draft: Pick<ReviewDraft, "rating" | "photos">,
  hasDish: boolean,
): { field: ReviewRequiredField; message: string } | null {
  if (!hasDish) return { field: "dish", message: "Choose a dish to review." };
  if (draft.photos.length === 0) {
    return { field: "photo", message: "Add a photo of the dish to publish." };
  }
  if (!draft.rating) return { field: "rating", message: "Add a star rating to publish." };
  return null;
}

/** Error code when a review saved but its photos did not attach (retry attaches them). */
export const REVIEW_PHOTOS_NOT_ATTACHED = "review_photos_not_attached";

/**
 * would_recommend sent by every review path: the reviewer's explicit Yes/No,
 * otherwise derived from the rating (4+ stars) instead of a silent "No".
 */
export function resolveWouldRecommend(
  recommend: boolean | null | undefined,
  rating: number,
): boolean {
  return typeof recommend === "boolean" ? recommend : rating >= 4;
}

/**
 * RFC 4122 v4 id generated on the client so a retried review submission reuses the same row id
 * (the server resumes instead of inserting a duplicate review).
 */
export function createClientReviewId(): string {
  const cryptoRef = (globalThis as { crypto?: Partial<Crypto> }).crypto;
  if (typeof cryptoRef?.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof cryptoRef?.getRandomValues === "function") {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
