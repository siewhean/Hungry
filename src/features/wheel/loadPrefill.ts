import { getHungryService } from "@/lib/services/serviceProvider";
import type { Coordinate, DietaryFlag, TasteVector } from "@/types/domain";
import {
  pickPrefillStalls,
  WHEEL_PREFILL_POOL_SIZE,
  WHEEL_PREFILL_RADIUS_METERS,
  type WheelPrefillStall,
} from "./prefill";

/**
 * The stalls a new wheel starts with: the nearest open ones that fit the diner's dietary needs,
 * from the same dish search Decide for Me uses (so distances are from the diner), then one read of
 * their hours. Throws when a read fails; the lobby reports it and leaves the wheel empty.
 */
export async function loadWheelPrefill(options: {
  origin: Coordinate;
  dietaryFlags: DietaryFlag[];
  tasteVector: TasteVector;
}): Promise<WheelPrefillStall[]> {
  const service = getHungryService();
  const results = await service.discovery.searchDishes(
    {
      query: "",
      categories: [],
      dietaryFlags: options.dietaryFlags,
      tasteValues: options.tasteVector,
      radius: WHEEL_PREFILL_RADIUS_METERS,
      latitude: options.origin.latitude,
      longitude: options.origin.longitude,
      limit: WHEEL_PREFILL_POOL_SIZE,
    },
    options.tasteVector,
  );
  const dishes = results
    .map((result) => result.dish)
    .filter((dish) => dish.distanceMeters <= WHEEL_PREFILL_RADIUS_METERS);
  const venueIds = [...new Set(dishes.map((dish) => dish.venueId))].slice(0, 50);
  const venues = await service.discovery.getVenuesByIds(venueIds);
  return pickPrefillStalls(dishes, new Map(venues.map((venue) => [venue.id, venue])));
}
