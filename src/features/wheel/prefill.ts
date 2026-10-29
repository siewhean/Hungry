import { getVenueOpenStateNow } from "@/features/discovery/decideForMeCandidates";
import type { DishDetail, VenueSummary } from "@/types/domain";

/** A new wheel starts with this many stalls, so a spin is one tap away. */
export const WHEEL_PREFILL_COUNT = 4;
/** How far a new wheel looks for them, in metres. */
export const WHEEL_PREFILL_RADIUS_METERS = 1500;
/** Dishes asked for per search (the server maximum), so there are enough different stalls. */
export const WHEEL_PREFILL_POOL_SIZE = 50;

export interface WheelPrefillStall {
  venueId: string;
  buildingId: string;
  label: string;
  imageUrl: string;
}

/**
 * The nearest stalls that are open now, one per stall, for a new wheel. Stalls with no readable
 * hours follow the open ones; closed stalls are never offered. `dishes` come from the dish search
 * (distance is measured from the diner), `venueById` carries the hours.
 */
export function pickPrefillStalls(
  dishes: DishDetail[],
  venueById: ReadonlyMap<string, VenueSummary | undefined>,
  now: Date = new Date(),
  count: number = WHEEL_PREFILL_COUNT,
): WheelPrefillStall[] {
  // One entry per stall: its nearest dish, the best rated one breaking a tie, gives the photo.
  const nearestByVenue = new Map<string, DishDetail>();
  for (const dish of dishes) {
    const current = nearestByVenue.get(dish.venueId);
    if (
      !current ||
      dish.distanceMeters < current.distanceMeters ||
      (dish.distanceMeters === current.distanceMeters && dish.rating > current.rating)
    ) {
      nearestByVenue.set(dish.venueId, dish);
    }
  }
  const ranked = [...nearestByVenue.values()]
    .map((dish) => {
      const venue = venueById.get(dish.venueId);
      const status = venue ? getVenueOpenStateNow(venue, now).status : "unknown";
      return { dish, venue, status };
    })
    .filter((item) => item.status !== "closed")
    .sort(
      (a, b) =>
        Number(b.status === "open") - Number(a.status === "open") ||
        a.dish.distanceMeters - b.dish.distanceMeters,
    );
  return ranked.slice(0, count).map(({ dish, venue }) => ({
    venueId: dish.venueId,
    buildingId: dish.buildingId,
    label: venue?.name || dish.venueName,
    imageUrl: dish.imageUrl,
  }));
}
