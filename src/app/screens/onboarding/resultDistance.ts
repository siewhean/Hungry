import { formatDistanceFromUser } from "@/features/detail/stallLocation";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import type { Coordinate, DishSummary, VenueSummary } from "@/types/domain";

type StallVenue = Pick<VenueSummary, "latitude" | "longitude">;

/**
 * "450m away" from the user to the dish's stall. The pin the dish came with (taste picks carry
 * it, so no catalog is needed) comes first, then the stall's own pin from the venue row; the
 * demo building list is only a last fallback, because production building ids are not in it.
 */
export function resultDistanceLabel(
  origin: Coordinate | undefined,
  dish: Pick<DishSummary, "buildingId" | "venueId" | "venuePin">,
  getVenueById: (venueId: string) => StallVenue | undefined,
): string | undefined {
  if (dish.venuePin) return formatDistanceFromUser(origin, dish.venuePin);
  const venue = getVenueById(dish.venueId);
  const pin =
    venue?.latitude !== undefined && venue.longitude !== undefined
      ? { latitude: venue.latitude, longitude: venue.longitude }
      : undefined;
  return formatDistanceFromUser(origin, pin ?? getBuildingById(dish.buildingId)?.coordinate);
}
