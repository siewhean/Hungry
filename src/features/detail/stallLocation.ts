import { getDistanceMetersFromCoordinates } from "@/lib/geo/distance";
import type { Coordinate, DishSummary, VenueSummary } from "@/types/domain";

type BuildingLocation = {
  name?: string;
  address?: string;
  postalCode?: string;
};

export function formatFullStallAddress(
  venue: Pick<VenueSummary, "name" | "unitNumber">,
  building?: BuildingLocation,
) {
  return [
    venue.name,
    venue.unitNumber,
    building?.name,
    building?.address,
    building?.postalCode ? `Singapore ${building.postalCode}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildMapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * "450m away" measured from the user to the stall's building, or undefined when
 * either point is unknown. dishes.distance_meters is a stored column, not the
 * distance from the user, so it is never shown here.
 */
export function formatDistanceFromUser(
  origin: Coordinate | undefined,
  buildingCoordinate: Coordinate | undefined,
) {
  if (!buildingCoordinate) return undefined;
  if (buildingCoordinate.latitude === 0 && buildingCoordinate.longitude === 0) return undefined;
  const meters = getDistanceMetersFromCoordinates(origin, buildingCoordinate);
  if (meters === undefined) return undefined;
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km away` : `${meters}m away`;
}

/** Review-weighted average of the stall's dish ratings, or undefined with no reviews. */
export function summarizeStallRating(dishes: Pick<DishSummary, "rating" | "reviewCount">[]) {
  let reviewCount = 0;
  let weightedTotal = 0;
  for (const dish of dishes) {
    if (dish.reviewCount <= 0 || dish.rating <= 0) continue;
    reviewCount += dish.reviewCount;
    weightedTotal += dish.rating * dish.reviewCount;
  }
  if (reviewCount === 0) return undefined;
  return { rating: weightedTotal / reviewCount, reviewCount };
}

/** "S$4.50–S$8.00" from the menu's listed prices, or undefined without prices. */
export function formatStallPriceBand(dishes: Pick<DishSummary, "price">[]) {
  const prices = dishes.map((dish) => dish.price).filter((price) => price > 0);
  if (prices.length === 0) return undefined;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const format = (price: number) => `S$${price.toFixed(2)}`;
  return low === high ? format(low) : `${format(low)}–${format(high)}`;
}
