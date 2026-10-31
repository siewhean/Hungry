import {
  getVenueOpenStateNow,
  minutesUntilOpening,
} from "@/features/discovery/decideForMeCandidates";
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
  /** "Opens 7am", set only on a stall that is closed now and was added to fill the wheel. */
  opensAt?: string;
}

/**
 * The nearest stalls that are open now, one per stall, for a new wheel. Stalls with no readable
 * hours follow the open ones. When fewer than `count` are open (late at night) the wheel is filled
 * with the closed stalls that open soonest, marked with when they open, so it can still spin.
 * `dishes` come from the dish search (distance is measured from the diner), `venueById` carries
 * the hours.
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
  const ranked = [...nearestByVenue.values()].map((dish) => {
    const venue = venueById.get(dish.venueId);
    const state = venue ? getVenueOpenStateNow(venue, now) : { status: "unknown" as const };
    return { dish, venue, state };
  });
  const toStall = (
    { dish, venue }: (typeof ranked)[number],
    opensAt?: string,
  ): WheelPrefillStall => ({
    venueId: dish.venueId,
    buildingId: dish.buildingId,
    label: venue?.name || dish.venueName,
    imageUrl: dish.imageUrl,
    ...(opensAt ? { opensAt } : {}),
  });
  const openNow = ranked
    .filter((item) => item.state.status !== "closed")
    .sort(
      (a, b) =>
        Number(b.state.status === "open") - Number(a.state.status === "open") ||
        a.dish.distanceMeters - b.dish.distanceMeters,
    )
    .slice(0, count)
    .map((item) => toStall(item));
  if (openNow.length >= count) return openNow;
  // Only stalls with a readable opening time can be offered as "opens soon".
  const soonest = ranked
    .filter((item) => item.state.status === "closed")
    .map((item) => ({ item, wait: minutesUntilOpening(item.state, now) }))
    .filter(({ wait }) => Number.isFinite(wait))
    .sort((a, b) => a.wait - b.wait || a.item.dish.distanceMeters - b.item.dish.distanceMeters)
    .slice(0, count - openNow.length)
    .map(({ item }) => toStall(item, item.state.detail));
  return [...openNow, ...soonest];
}
