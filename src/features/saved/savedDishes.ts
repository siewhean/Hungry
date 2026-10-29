import { buildStallMapsUrl, formatDistanceFromUser } from "@/features/detail/stallLocation";
import { getDistanceMetersFromCoordinates } from "@/lib/geo/distance";
import type { SavedDishCard } from "@/lib/services/types";
import type { Coordinate } from "@/types/domain";

export type SavedSort = "recent" | "nearest" | "top_rated";

export const SAVED_SORT_LABELS: Record<SavedSort, string> = {
  recent: "Recent",
  nearest: "Nearest",
  top_rated: "Top rated",
};

export const SAVED_SORTS = Object.keys(SAVED_SORT_LABELS) as SavedSort[];

/** Case-insensitive match on the dish or its stall, for the saved-dishes search box. */
export function matchesSavedDishQuery(
  dish: { name: string; venueName?: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    dish.name.toLowerCase().includes(needle) ||
    (dish.venueName ?? "").toLowerCase().includes(needle)
  );
}

/**
 * Where "near me" is measured from: the device position once location is allowed, else a place
 * the diner picked by hand. Undefined when neither exists, so nothing shows a made-up distance.
 */
export function getSavedOrigin(location: {
  permission: "unknown" | "granted" | "denied";
  currentLocation: Coordinate;
  manualCoordinate?: Coordinate;
}): Coordinate | undefined {
  if (location.manualCoordinate) return location.manualCoordinate;
  return location.permission === "granted" ? location.currentLocation : undefined;
}

export function savedDishCoordinate(dish: SavedDishCard): Coordinate | undefined {
  if (dish.latitude === undefined || dish.longitude === undefined) return undefined;
  return { latitude: dish.latitude, longitude: dish.longitude };
}

export function savedDishDistanceMeters(
  dish: SavedDishCard,
  origin: Coordinate | undefined,
): number | undefined {
  return getDistanceMetersFromCoordinates(origin, savedDishCoordinate(dish));
}

/** "450m away", or undefined when the position or the stall's point is unknown. */
export function formatSavedDishDistance(dish: SavedDishCard, origin: Coordinate | undefined) {
  return formatDistanceFromUser(origin, savedDishCoordinate(dish));
}

/** The order of the saved list for a sort chip; unknown distances and ratings go last. */
export function sortSavedDishes(
  dishes: readonly SavedDishCard[],
  sort: SavedSort,
  origin: Coordinate | undefined,
): SavedDishCard[] {
  if (sort === "recent") return [...dishes];
  const keyed = dishes.map((dish, index) => ({
    dish,
    index,
    distance: savedDishDistanceMeters(dish, origin),
  }));
  keyed.sort((left, right) => {
    if (sort === "nearest") {
      if (left.distance === undefined && right.distance === undefined)
        return left.index - right.index;
      if (left.distance === undefined) return 1;
      if (right.distance === undefined) return -1;
      return left.distance - right.distance || left.index - right.index;
    }
    const leftRated = left.dish.rating !== undefined && (left.dish.reviewCount ?? 0) > 0;
    const rightRated = right.dish.rating !== undefined && (right.dish.reviewCount ?? 0) > 0;
    if (leftRated !== rightRated) return leftRated ? -1 : 1;
    if (!leftRated) return left.index - right.index;
    return (
      (right.dish.rating ?? 0) - (left.dish.rating ?? 0) ||
      (right.dish.reviewCount ?? 0) - (left.dish.reviewCount ?? 0) ||
      left.index - right.index
    );
  });
  return keyed.map((entry) => entry.dish);
}

/** "#01-23 · Maxwell Food Centre", or whichever half is known. */
export function savedDishPlaceLine(dish: SavedDishCard): string {
  return [dish.unitNumber?.trim(), dish.buildingName?.trim()].filter(Boolean).join(" · ");
}

/** "1 craving saved for later" / "5 cravings saved for later". */
export function formatSavedCount(count: number): string {
  return `${count} ${count === 1 ? "craving" : "cravings"} saved for later`;
}

/** Google Maps link for the dish's stall by name and address, never raw coordinates first. */
export function buildSavedDirectionsUrl(dish: SavedDishCard): string | undefined {
  if (!dish.venueName) return undefined;
  return buildStallMapsUrl(
    {
      name: dish.venueName,
      buildingName: dish.buildingName,
      address: dish.address,
      postalCode: dish.postalCode,
    },
    savedDishCoordinate(dish),
  );
}
