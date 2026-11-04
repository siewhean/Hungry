import { getDistanceMetersFromCoordinates } from "@/lib/geo/distance";
import { searchPickerDishes, searchPickerVenues } from "@/features/checklistPortfolio/pickerSearch";
import type { Coordinate } from "@/types/domain";
import type { PickerDish, PickerRow, PickerVenue } from "./dishPicker";

/** Shortest search sent to the server; a single letter matches too much to be useful. */
export const PICKER_MIN_QUERY_LENGTH = 2;
/** How long typing must pause before the server is asked. */
export const PICKER_SEARCH_DEBOUNCE_MS = 250;
const PICKER_SERVER_LIMIT = 20;

/**
 * Stalls and dishes matching a search, read from the server (paged) instead of searching the
 * whole catalog on the phone. Throws when the search cannot be read so the caller can fall back
 * to the cached catalog.
 */
export async function searchServerPickerRows(input: {
  query: string;
  origin?: Coordinate;
  buildingCoordinates?: ReadonlyMap<string, Coordinate>;
  buildingNames?: ReadonlyMap<string, string>;
}): Promise<PickerRow[]> {
  const query = input.query.trim();
  if (query.length < PICKER_MIN_QUERY_LENGTH) return [];
  const [venueResults, dishResults] = await Promise.all([
    searchPickerVenues(query, PICKER_SERVER_LIMIT),
    searchPickerDishes(query, PICKER_SERVER_LIMIT),
  ]);

  const venues = new Map<string, PickerVenue>();
  for (const venue of venueResults) {
    venues.set(venue.id, {
      id: venue.id,
      name: venue.name,
      unitNumber: venue.unitNumber,
      buildingId: venue.buildingId,
      buildingName: venue.buildingName ?? input.buildingNames?.get(venue.buildingId),
      imageUrl: venue.logoUrl ?? venue.imageUrl,
    });
  }

  const distanceOf = (buildingId: string | undefined): number | undefined => {
    if (!input.origin || !buildingId) return undefined;
    return getDistanceMetersFromCoordinates(
      input.origin,
      input.buildingCoordinates?.get(buildingId),
    );
  };
  const byDistance = (a: PickerRow, b: PickerRow) =>
    (a.distanceMeters ?? Number.POSITIVE_INFINITY) -
      (b.distanceMeters ?? Number.POSITIVE_INFINITY) || 0;

  const venueRows = Array.from(venues.values())
    .map(
      (venue): PickerRow => ({
        kind: "venue",
        key: `venue:${venue.id}`,
        venue,
        distanceMeters: distanceOf(venue.buildingId),
      }),
    )
    .sort(byDistance);

  const dishRows = dishResults
    .map((dish): PickerRow => {
      const venue = venues.get(dish.venueId);
      const pickerDish: PickerDish = {
        id: dish.id,
        name: dish.name,
        venueId: dish.venueId,
        venueName: dish.venueName,
        buildingName: venue?.buildingName ?? input.buildingNames?.get(dish.buildingId),
        imageUrl: dish.imageUrl,
      };
      return {
        kind: "dish",
        key: `dish:${dish.id}`,
        dish: pickerDish,
        venue,
        distanceMeters: distanceOf(dish.buildingId),
      };
    })
    .sort(byDistance);

  return [...venueRows, ...dishRows];
}
