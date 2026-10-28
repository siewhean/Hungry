import { formatDistanceFromUser } from "@/features/detail/stallLocation";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import type { Coordinate, DishSummary, VenueSummary } from "@/types/domain";

type StallVenue = Pick<VenueSummary, "latitude" | "longitude">;

/**
 * "450m away" from the user to the dish's stall. The stall's own pin (the venue row, which
 * covers every building in the catalog) comes first; the demo building list is only a
 * fallback, because production building ids are not in it.
 */
export function resultDistanceLabel(
  origin: Coordinate | undefined,
  dish: Pick<DishSummary, "buildingId" | "venueId">,
  getVenueById: (venueId: string) => StallVenue | undefined,
): string | undefined {
  const venue = getVenueById(dish.venueId);
  const pin =
    venue?.latitude !== undefined && venue.longitude !== undefined
      ? { latitude: venue.latitude, longitude: venue.longitude }
      : undefined;
  return formatDistanceFromUser(origin, pin ?? getBuildingById(dish.buildingId)?.coordinate);
}
