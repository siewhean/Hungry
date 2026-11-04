// The words and choices behind a review share card: what each template shows, which templates a
// review can use, and how big the picture is. The card artwork lives in
// src/components/share/ReviewShareCard.tsx; this file holds no React so it is easy to test.

export type ReviewCardTemplate = "photo" | "snapshot" | "chit" | "quote" | "sticker";
export type ReviewCardSize = "story" | "post";

/** Cards are laid out at this width (points) and scaled; every size in the artwork is relative to it. */
export const REVIEW_CARD_BASE_WIDTH = 360;

/** The picture sizes, in pixels: an Instagram Story (9:16) and a feed post (4:5). */
export const REVIEW_CARD_SIZES: Record<
  ReviewCardSize,
  { label: string; width: number; height: number }
> = {
  story: { label: "Story", width: 1080, height: 1920 },
  post: { label: "Post", width: 1080, height: 1350 },
};

export const REVIEW_CARD_TEMPLATES: Record<
  ReviewCardTemplate,
  { label: string; description: string; needsPhoto: boolean; needsQuote: boolean }
> = {
  photo: {
    label: "Photo",
    description: "Your photo, full size",
    needsPhoto: true,
    needsQuote: false,
  },
  snapshot: {
    label: "Snapshot",
    description: "A printed photo on paper",
    needsPhoto: true,
    needsQuote: false,
  },
  quote: {
    label: "Big quote",
    description: "Your words, large",
    needsPhoto: false,
    needsQuote: true,
  },
  chit: {
    label: "Order chit",
    description: "A kopitiam order chit",
    needsPhoto: false,
    needsQuote: false,
  },
  sticker: {
    label: "Sticker",
    description: "See-through, to place over your own photo",
    needsPhoto: false,
    needsQuote: false,
  },
};

/** The order templates are offered in. Photo templates lead when there is a photo to show. */
const TEMPLATE_ORDER: ReviewCardTemplate[] = ["photo", "snapshot", "quote", "chit", "sticker"];

/** Longest quote a card prints; longer reviews are cut at a word and end with an ellipsis. */
export const REVIEW_CARD_QUOTE_MAX = 140;
/** Most taste tags a card prints. */
export const REVIEW_CARD_MAX_TAGS = 3;

export interface ReviewCardInput {
  reviewId: string;
  dishName: string;
  venueName: string;
  rating: number;
  text?: string;
  tags?: readonly string[];
  /** The review's first photo; a local file right after posting, a web address later. */
  photoUrl?: string;
  authorName: string;
  /** ISO time the review was posted. */
  createdAt?: string;
}

export interface ReviewCardModel {
  reviewId: string;
  dishName: string;
  venueName: string;
  /** Whole stars, 0 to 5. */
  rating: number;
  /** The review text cut to fit a card; empty when the review has no words. */
  quote: string;
  tags: string[];
  photoUrl?: string;
  authorName: string;
  /** e.g. "4 Nov 2026". */
  dateLabel: string;
  /** One short line from the rating, for the order chit. */
  verdict: string;
}

/** Cuts text to `max` characters at a word break, with an ellipsis when anything was cut. */
export function trimQuote(text: string, max = REVIEW_CARD_QUOTE_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const wordCut = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${wordCut.replace(/[\s,.;:!?-]+$/, "")}…`;
}

export function verdictFor(rating: number): string {
  if (rating >= 5) return "Must try";
  if (rating >= 4) return "Go again";
  if (rating >= 3) return "Not bad";
  return "Once is enough";
}

export function cardDateLabel(iso: string | undefined, now: Date = new Date()): string {
  const date = iso ? new Date(iso) : now;
  const valid = Number.isNaN(date.getTime()) ? now : date;
  return valid.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

export function buildReviewCardModel(
  input: ReviewCardInput,
  now: Date = new Date(),
): ReviewCardModel {
  const rating = Math.max(
    0,
    Math.min(5, Math.round(Number.isFinite(input.rating) ? input.rating : 0)),
  );
  const tags = Array.from(
    new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
  ).slice(0, REVIEW_CARD_MAX_TAGS);
  const photoUrl = input.photoUrl?.trim() || undefined;
  return {
    reviewId: input.reviewId,
    dishName: input.dishName.trim() || "A dish",
    venueName: input.venueName.trim(),
    rating,
    quote: trimQuote(input.text ?? ""),
    tags,
    photoUrl,
    authorName: input.authorName.trim() || "A Hungry diner",
    dateLabel: cardDateLabel(input.createdAt, now),
    verdict: verdictFor(rating),
  };
}

/** The templates this review can fill, in the order the share screen offers them. */
export function availableReviewCardTemplates(model: ReviewCardModel): ReviewCardTemplate[] {
  return TEMPLATE_ORDER.filter((template) => {
    const meta = REVIEW_CARD_TEMPLATES[template];
    if (meta.needsPhoto && !model.photoUrl) return false;
    if (meta.needsQuote && !model.quote) return false;
    return true;
  });
}

/** Height of a card laid out `width` points wide. */
export function reviewCardHeight(size: ReviewCardSize, width: number): number {
  const { width: pixelWidth, height: pixelHeight } = REVIEW_CARD_SIZES[size];
  return Math.round((width * pixelHeight) / pixelWidth);
}

/** The sticker keeps its see-through background, so it is saved as a PNG; the rest as JPEG. */
export function reviewCardImageFormat(template: ReviewCardTemplate): "png" | "jpg" {
  return template === "sticker" ? "png" : "jpg";
}
