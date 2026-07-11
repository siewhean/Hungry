import type { DataRepository } from "@/lib/services/types";
import type { DishDetail, Review } from "@/types/domain";

function sanitizeInteractionSeed(value?: string) {
  return (value ?? "").trim() || "missing";
}

export function makeReviewInteractionId(
  dishId: string,
  reviewId: string,
  rowIndex: number,
  reviewFingerprint?: string,
) {
  const reviewSeed = sanitizeInteractionSeed(reviewId);
  const indexSeed = sanitizeInteractionSeed(reviewFingerprint);
  return `${dishId}::${reviewSeed}::${rowIndex}::${indexSeed}`;
}

export type ReviewFeedItem = {
  review: Review;
  dish: DishDetail;
  dishName: string;
  venueName: string;
  venueId: string;
  dishId: string;
  interactionId: string;
};

export function listReviewFeedItems(repository: DataRepository): ReviewFeedItem[] {
  return repository.listBuildings().flatMap((building) =>
    repository.listVenuesByBuilding(building.id).flatMap((venue) =>
      repository.listDishesByVenue(venue.id).flatMap((dish) =>
        dish.reviews.map((review, reviewIndex) => ({
          review,
          dish,
          dishId: dish.id,
          dishName: dish.name,
          venueName: dish.venueName,
          venueId: dish.venueId,
          interactionId: makeReviewInteractionId(
            dish.id,
            review.id,
            reviewIndex,
            `${dish.id}::${dish.venueName}::${review.createdAt}::${review.text}`,
          ),
        })),
      ),
    ),
  );
}
