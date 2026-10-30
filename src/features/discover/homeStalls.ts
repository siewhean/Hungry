/**
 * Pure rules for the stall list on Home: the open-state line and the order. The screen passes
 * the cards it already holds; nothing here reads a service.
 */
import type { DishDetail, VenueSummary } from "@/types/domain";
import { getVenueOpenState } from "@/utils/operatingHours";

export type HomeStallCard = { venue: VenueSummary; topDish?: DishDetail };

/** "Open · Closes 9pm" / "Closed · Opens 5pm" for stall rows; nothing when hours are unknown. */
export function getStallRowOpenLabel(venue: Pick<VenueSummary, "operatingHours" | "isOpen">) {
  const state = getVenueOpenState(venue.operatingHours, venue.isOpen);
  if (state.status === "unknown") return undefined;
  const status = state.status === "open" ? "Open" : "Closed";
  // "Closed today" and "Closed for today" only repeat the status.
  return state.detail && !/^closed/i.test(state.detail) ? `${status} · ${state.detail}` : status;
}

const OPEN_RANK = { open: 0, unknown: 1, closed: 2 } as const;

export function isStallClosed(venue: Pick<VenueSummary, "operatingHours" | "isOpen">) {
  return getVenueOpenState(venue.operatingHours, venue.isOpen).status === "closed";
}

function distanceOf({ venue, topDish }: HomeStallCard) {
  return venue.distanceMeters ?? topDish?.distanceMeters ?? Number.POSITIVE_INFINITY;
}

function ratingScore({ topDish }: HomeStallCard) {
  return (topDish?.rating ?? 0) * 100 + (topDish?.reviewCount ?? 0);
}

/** Open first, then stalls with a menu, then nearest, then best rated. */
export function compareHomeStalls(a: HomeStallCard, b: HomeStallCard): number {
  const openOrder =
    OPEN_RANK[getVenueOpenState(a.venue.operatingHours, a.venue.isOpen).status] -
    OPEN_RANK[getVenueOpenState(b.venue.operatingHours, b.venue.isOpen).status];
  if (openOrder !== 0) return openOrder;
  const menuOrder = Number(!a.topDish) - Number(!b.topDish);
  if (menuOrder !== 0) return menuOrder;
  const distanceA = distanceOf(a);
  const distanceB = distanceOf(b);
  if (distanceA !== distanceB) return distanceA < distanceB ? -1 : 1;
  return ratingScore(b) - ratingScore(a);
}
