import type { DataRepository } from "@/lib/services/types";
import type { DishDetail, Review } from "@/types/domain";

export type ReviewFeedItem = {
  review: Review;
  dish: DishDetail;
  dishName: string;
  venueName: string;
  venueId: string;
  dishId: string;
};

export function listReviewFeedItems(repository: DataRepository): ReviewFeedItem[] {
  return repository.listBuildings().flatMap((building) =>
    repository.listVenuesByBuilding(building.id).flatMap((venue) =>
      repository.listDishesByVenue(venue.id).flatMap((dish) =>
        dish.reviews.map((review) => ({
          review,
          dish,
          dishId: dish.id,
          dishName: dish.name,
          venueName: dish.venueName,
          venueId: dish.venueId,
        })),
      ),
    ),
  );
}
