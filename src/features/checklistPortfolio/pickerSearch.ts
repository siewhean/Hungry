import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { DishDetail, VenueSummary } from "@/types/domain";

/** Results per "Show more" step in the list item pickers. */
export const PICKER_PAGE_SIZE = 30;
/** search_venues_by_location returns at most 100 rows. */
export const PICKER_MAX_RESULTS = 100;

export function nextPickerLimit(limit: number): number {
  return Math.min(limit + PICKER_PAGE_SIZE, PICKER_MAX_RESULTS);
}

export function canShowMorePickerResults(resultCount: number, limit: number): boolean {
  return resultCount >= limit && limit < PICKER_MAX_RESULTS;
}

export async function searchPickerDishes(query: string, limit: number): Promise<DishDetail[]> {
  const results = await getHungryService().discovery.searchDishes(
    {
      query,
      categories: [],
      dietaryFlags: [],
      tasteValues: NEUTRAL_TASTE_VECTOR,
      radius: 5000,
    },
    NEUTRAL_TASTE_VECTOR,
  );
  return results.slice(0, limit).map((result) => result.dish);
}

/**
 * Stalls from the whole catalog through the venue search RPC (no location, so
 * no radius), instead of the first few buildings' stalls filtered on the phone.
 */
export async function searchPickerVenues(query: string, limit: number): Promise<VenueSummary[]> {
  const venues = await getHungryService().discovery.searchVenuesByLocation({
    query: query.trim() || undefined,
    limit,
  });
  return venues ?? [];
}

/**
 * Stalls that match by name, then the stalls that serve a dish matching the query ("laksa" finds
 * the laksa stalls, not only a stall called Laksa). The dish matches are looked up in one batched
 * read. A failed dish search leaves the name matches in place.
 */
export async function searchPickerStalls(query: string, limit: number): Promise<VenueSummary[]> {
  const [venues, dishes] = await Promise.all([
    searchPickerVenues(query, limit),
    searchPickerDishes(query, limit).catch((error: unknown) => {
      reportError(error, { screen: "PickerSearch", action: "search_dishes" });
      return [] as DishDetail[];
    }),
  ]);
  const seen = new Set(venues.map((venue) => venue.id));
  const dishVenueIds = [...new Set(dishes.map((dish) => dish.venueId))].filter(
    (id) => !seen.has(id),
  );
  const dishVenues = dishVenueIds.length
    ? await getHungryService().discovery.getVenuesByIds(dishVenueIds)
    : [];
  return [...venues, ...dishVenues].slice(0, limit);
}
