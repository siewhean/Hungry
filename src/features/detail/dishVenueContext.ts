import type { DataRepository } from "@/lib/services/types";
import type { DishDetail } from "@/types/domain";

/** Resolve detail attribution and related menu from the same canonical venue ID. */
export function getDishVenueContext(
  dish: DishDetail | undefined,
  repository: Pick<DataRepository, "getVenueById" | "listDishesByVenue">,
) {
  if (!dish) return { venue: undefined, dishes: [] as DishDetail[] };
  const venue = repository.getVenueById(dish.venueId);
  return {
    venue: venue?.id === dish.venueId ? venue : undefined,
    dishes: repository
      .listDishesByVenue(dish.venueId)
      .filter((candidate) => candidate.venueId === dish.venueId),
  };
}
