/**
 * Pure rules for Home's malls and hawker centres rail. The screen passes the cards it holds;
 * nothing here reads a service.
 */
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
 * The malls and hawker centres around the diner, nearest first: one entry per building the
 * feed's stalls sit in, leaving out the building they are already in (it has its own section).
 */
export function groupNearbyPlaces<B extends PlaceBuilding>(
  cards: readonly (HomeStallCard & { building: B })[],
  currentPlaceId: string | null | undefined,
  limit = 8,
): NearbyPlace<B>[] {
  const places = new Map<string, NearbyPlace<B>>();
  for (const card of cards) {
    if (!card.venue.buildingId || card.venue.buildingId === currentPlaceId) continue;
    const distance = card.venue.distanceMeters ?? card.topDish?.distanceMeters;
    const existing = places.get(card.venue.buildingId);
    if (!existing) {
      places.set(card.venue.buildingId, {
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
