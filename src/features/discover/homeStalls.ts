/**
 * Pure rules for the stall list on Home: the open-state line and the order. The screen passes
 * the cards it already holds; nothing here reads a service.
 */
import type { BuildingSummary, DishDetail, VenueSummary } from "@/types/domain";

/** What a nearby-place card needs of a building. */
export type PlaceBuilding = Pick<BuildingSummary, "id" | "name" | "imageUrl" | "logoUrl">;
import { getClosureLabel, isClosureActive } from "@/features/merchant/closure";
import { getVenueOpenState } from "@/utils/operatingHours";

type OpenStateVenue = Pick<VenueSummary, "operatingHours" | "isOpen" | "closedUntil">;

/** The stall page's rule on Home too: a merchant's "Closed today" / "Reopens 3 Nov" comes first. */
function openStateOf(venue: OpenStateVenue) {
  if (isClosureActive(venue.closedUntil)) {
    return { status: "closed" as const, detail: getClosureLabel(venue.closedUntil) };
  }
  return getVenueOpenState(venue.operatingHours, venue.isOpen);
}

export type HomeStallCard = { venue: VenueSummary; topDish?: DishDetail };

/** "Open · Closes 9pm" / "Closed · Opens 5pm" for stall rows; nothing when hours are unknown. */
export function getStallRowOpenLabel(venue: OpenStateVenue) {
  const state = openStateOf(venue);
  if (state.status === "unknown") return undefined;
  const status = state.status === "open" ? "Open" : "Closed";
  // "Closed today" and "Closed for today" only repeat the status.
  return state.detail && !/^closed/i.test(state.detail) ? `${status} · ${state.detail}` : status;
}

const OPEN_RANK = { open: 0, unknown: 1, closed: 2 } as const;

export function isStallClosed(venue: OpenStateVenue) {
  return openStateOf(venue).status === "closed";
}

function distanceOf({ venue, topDish }: HomeStallCard) {
  return venue.distanceMeters ?? topDish?.distanceMeters ?? Number.POSITIVE_INFINITY;
}

function ratingScore({ topDish }: HomeStallCard) {
  return (topDish?.rating ?? 0) * 100 + (topDish?.reviewCount ?? 0);
}

/** Open first, then stalls with a menu, then nearest, then best rated. */
export function compareHomeStalls(a: HomeStallCard, b: HomeStallCard): number {
  const openOrder = OPEN_RANK[openStateOf(a.venue).status] - OPEN_RANK[openStateOf(b.venue).status];
  if (openOrder !== 0) return openOrder;
  const menuOrder = Number(!a.topDish) - Number(!b.topDish);
  if (menuOrder !== 0) return menuOrder;
  const distanceA = distanceOf(a);
  const distanceB = distanceOf(b);
  if (distanceA !== distanceB) return distanceA < distanceB ? -1 : 1;
  return ratingScore(b) - ratingScore(a);
}

/** Stalls open right now, nearest first. A stall with unknown hours is not counted as open. */
export function pickOpenNowStalls<T extends HomeStallCard>(cards: readonly T[], limit = 10): T[] {
  return cards
    .filter(({ venue }) => openStateOf(venue).status === "open")
    .sort((a, b) => distanceOf(a) - distanceOf(b) || ratingScore(b) - ratingScore(a))
    .slice(0, limit);
}

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
