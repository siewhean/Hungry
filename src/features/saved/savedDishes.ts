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

/** The sections of the one Saved page. Posts only show while the social feed is on. */
export type SavedSection = "dishes" | "stalls" | "lists" | "posts";

export const SAVED_SECTION_LABELS: Record<SavedSection, string> = {
  dishes: "Dishes",
  stalls: "Stalls",
  lists: "Lists",
  posts: "Posts",
};

/** The sections to show, in order. */
export function visibleSavedSections(socialFeedEnabled: boolean): SavedSection[] {
  return (Object.keys(SAVED_SECTION_LABELS) as SavedSection[]).filter(
    (key) => key !== "posts" || socialFeedEnabled,
  );
}

export type SavedLayout = "card" | "row";

/**
 * Photo cards only pay off when at least three in four saved dishes have a photo; otherwise a card is a 180pt grey
 * box and a screen shows two and a half dishes. The list decides, so the density experiment only
 * moves lists that can show either layout.
 */
export function savedListHasPhotos(dishes: readonly SavedDishCard[]): boolean {
  if (dishes.length === 0) return false;
  const withPhoto = dishes.filter((dish) => Boolean(dish.imageUrl)).length;
  return withPhoto * 4 >= dishes.length * 3;
}

/** One pin on the Saved map: every saved dish at the same stall shares it. */
export type SavedMapPin = {
  id: string;
  coordinate: Coordinate;
  venueName: string;
  dishes: SavedDishCard[];
};

/**
 * Pins for the saved dishes that have a point, grouped by stall (else by the exact point), plus
 * the dishes with no point, which the map names in an "N not on the map" note.
 */
export function groupSavedMapPins(dishes: readonly SavedDishCard[]): {
  pins: SavedMapPin[];
  notOnMap: SavedDishCard[];
} {
  const byKey = new Map<string, SavedMapPin>();
  const notOnMap: SavedDishCard[] = [];
  for (const dish of dishes) {
    const coordinate = savedDishCoordinate(dish);
    if (!coordinate) {
      notOnMap.push(dish);
      continue;
    }
    const key = dish.venueId ?? `${coordinate.latitude},${coordinate.longitude}`;
    const existing = byKey.get(key);
    if (existing) existing.dishes.push(dish);
    else {
      byKey.set(key, {
        id: key,
        coordinate,
        venueName: dish.venueName ?? dish.name,
        dishes: [dish],
      });
    }
  }
  return { pins: [...byKey.values()], notOnMap };
}

/** The middle of all pins and a zoom that fits them; Singapore's centre when there are none. */
export function fitSavedPins(pins: readonly { coordinate: Coordinate }[]): {
  center: Coordinate;
  zoom: number;
} {
  if (pins.length === 0) return { center: { latitude: 1.3521, longitude: 103.8198 }, zoom: 11 };
  const lats = pins.map((pin) => pin.coordinate.latitude);
  const lngs = pins.map((pin) => pin.coordinate.longitude);
  const center = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
  const span = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lngs) - Math.min(...lngs),
  );
  // Mapbox zoom halves the visible span per level; ~0.35 degrees fills the island at zoom 11.
  const zoom = span <= 0.002 ? 16 : Math.max(10, Math.min(16, 11 + Math.log2(0.35 / span)));
  return { center, zoom };
}
