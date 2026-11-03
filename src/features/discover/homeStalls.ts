/**
 * Pure rules for the stall list on Home: the open-state line and the order. The screen passes
 * the cards it already holds; nothing here reads a service.
 */
import type { DishDetail, VenueSummary } from "@/types/domain";
import { getClosureLabel, isClosureActive } from "@/features/merchant/closure";
import {
  FRESH_REVIEW_LIMIT,
  MAX_QUALITY_POINTS,
  qualityPoints,
} from "@/features/discover/rankingBalance";
import { DISTANCE_DECAY_FLOOR, distanceDecayFactor } from "@/lib/ai/tasteEngine";
import { getVenueOpenState } from "@/utils/operatingHours";

type OpenStateVenue = Pick<VenueSummary, "operatingHours" | "isOpen" | "closedUntil">;

/** The stall page's rule on Home too: a merchant's "Closed today" / "Reopens 3 Nov" comes first. */
export function openStateOf(venue: OpenStateVenue) {
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

export function distanceOf({ venue, topDish }: HomeStallCard) {
  return venue.distanceMeters ?? topDish?.distanceMeters ?? Number.POSITIVE_INFINITY;
}

export function ratingScore({ topDish }: HomeStallCard) {
  return (topDish?.rating ?? 0) * 100 + (topDish?.reviewCount ?? 0);
}

/**
 * How good a stall looks for the list: near beats far, and a well-reviewed stall beats a poorly
 * reviewed one at a similar distance. Quality is worth up to 30% of the score, only as far as the
 * number of reviews backs it (see qualityPoints).
 */
export function stallListScore(card: HomeStallCard): number {
  const distance = distanceOf(card);
  const nearness = Number.isFinite(distance) ? distanceDecayFactor(distance) : DISTANCE_DECAY_FLOOR;
  const points = card.topDish ? qualityPoints(card.topDish.rating, card.topDish.reviewCount) : 0;
  const quality = 0.5 + points / (2 * MAX_QUALITY_POINTS);
  return nearness * (0.7 + 0.3 * quality);
}

/** True for a stall whose top dish has too few reviews to judge: it is new to the list. */
export function isUnprovenStall(card: HomeStallCard): boolean {
  return Boolean(card.topDish) && (card.topDish?.reviewCount ?? 0) < FRESH_REVIEW_LIMIT;
}

/** Open first, then stalls with a menu, then the best near-and-good score, then nearest. */
export function compareHomeStalls(a: HomeStallCard, b: HomeStallCard): number {
  const openOrder = OPEN_RANK[openStateOf(a.venue).status] - OPEN_RANK[openStateOf(b.venue).status];
  if (openOrder !== 0) return openOrder;
  const menuOrder = Number(!a.topDish) - Number(!b.topDish);
  if (menuOrder !== 0) return menuOrder;
  const scoreOrder = stallListScore(b) - stallListScore(a);
  if (Math.abs(scoreOrder) > 1e-9) return scoreOrder;
  const distanceA = distanceOf(a);
  const distanceB = distanceOf(b);
  if (distanceA !== distanceB) return distanceA < distanceB ? -1 : 1;
  return ratingScore(b) - ratingScore(a);
}
