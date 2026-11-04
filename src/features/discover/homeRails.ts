/**
 * Pure rules for Home's malls and hawker centres rail. The screen passes the cards it holds;
 * nothing here reads a service.
 */
import { placeKey } from "@/features/detail/placeNames";
import type { HomeStallCard } from "@/features/discover/homeStalls";
import type { BuildingSummary } from "@/types/domain";

/** What a nearby-place card needs of a building. */
export type PlaceBuilding = Pick<BuildingSummary, "id" | "name" | "imageUrl" | "logoUrl">;

export type NearbyPlace<B extends PlaceBuilding = PlaceBuilding> = {
  building: B;
  /** Stalls from the feed that are in this building. */
  stallCount: number;
  /** Metres to the nearest of them; undefined when none has a distance. */
  distanceMeters: number | undefined;
};

/**
 * The malls and hawker centres around the diner, nearest first: one entry per place the feed's
 * stalls sit in, leaving out the place they are already in (it has its own section). The catalog
 * can hold one place as several buildings ("Pioneer Mrt Station" and "Singapore 648310 Pioneer
 * Mrt Stn"), so places with the same cleaned name are one entry; its building is the first met.
 */
export function groupNearbyPlaces<B extends PlaceBuilding>(
  cards: readonly (HomeStallCard & { building: B })[],
  currentPlaceId: string | null | undefined,
  limit = 8,
): NearbyPlace<B>[] {
  const places = new Map<string, NearbyPlace<B>>();
  const keyOf = (card: HomeStallCard & { building: B }) =>
    placeKey(card.building.name) || (card.venue.buildingId as string);
  const currentKeys = new Set(
    cards.filter((card) => card.venue.buildingId === currentPlaceId).map(keyOf),
  );
  for (const card of cards) {
    if (!card.venue.buildingId || card.venue.buildingId === currentPlaceId) continue;
    const key = keyOf(card);
    if (currentKeys.has(key)) continue;
    const distance = card.venue.distanceMeters ?? card.topDish?.distanceMeters;
    const existing = places.get(key);
    if (!existing) {
      places.set(key, {
        building: card.building,
        stallCount: 1,
        distanceMeters: distance,
      });
      continue;
    }
    existing.stallCount += 1;
    if (distance !== undefined && (existing.distanceMeters ?? Infinity) > distance) {
      existing.distanceMeters = distance;
    }
  }
  return [...places.values()]
    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
    .slice(0, limit);
}
