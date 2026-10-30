/**
 * Pure rules for the stall list on Home: the open-state line and the order. The screen passes
 * the cards it already holds; nothing here reads a service.
 */
import type { DishDetail, VenueSummary } from "@/types/domain";
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
