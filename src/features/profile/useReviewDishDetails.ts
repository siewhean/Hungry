import { useCallback, useMemo } from "react";

import { useItemDetailsState } from "@/features/checklistPortfolio/useItemLabels";
import { getDataRepository } from "@/lib/services/serviceProvider";
import type { Review } from "@/types/domain";

/** What a review card shows about its dish. */
export type ReviewDishInfo =
  | { status: "ready"; name: string; stallName?: string; imageUrl?: string }
  /** The lookup is still on its way: say "Loading…", never "Reviewed dish". */
  | { status: "loading" }
  /** The lookup finished and the dish is gone. */
  | { status: "unavailable" }
  /** The lookup itself failed (offline, timeout): not the same as a deleted dish. */
  | { status: "failed" };

/**
 * Dish name, stall and photo for a list of reviews: one batched `get_item_details` call for the
 * whole list (not one per card). The dishes already cached on this device paint first.
 */
export function useReviewDishDetails(reviews: readonly Pick<Review, "dishId">[]): {
  infoFor: (dishId: string | undefined) => ReviewDishInfo;
  retry: () => void;
} {
  const items = useMemo(
    () => reviews.flatMap((review) => (review.dishId ? [{ dishId: review.dishId }] : [])),
    [reviews],
  );
  const { details, isLoaded, failedIds, retry } = useItemDetailsState(items);
  const repository = getDataRepository();

  const infoFor = useCallback(
    (dishId: string | undefined): ReviewDishInfo => {
      if (!dishId) return { status: "unavailable" };
      const detail = details[dishId];
      if (detail) {
        return {
          status: "ready",
          name: detail.name,
          stallName: detail.stallName,
          imageUrl: detail.imageUrl,
        };
      }
      const cached = repository.getDishById(dishId);
      if (cached) {
        return {
          status: "ready",
          name: cached.name,
          stallName: cached.venueName ?? repository.getVenueById(cached.venueId)?.name,
          imageUrl: cached.imageUrl,
        };
      }
      if (!isLoaded) return { status: "loading" };
      return failedIds.has(dishId) ? { status: "failed" } : { status: "unavailable" };
    },
    [details, failedIds, isLoaded, repository],
  );

  return { infoFor, retry };
}
