import { filterSafeDishes } from "@/lib/ai/dietaryGate";
import { hasPersonalTasteProfile, tasteMatchPercent } from "@/lib/ai/tasteEngine";
import { getScheduleOpenState, hasWeeklyHours } from "@/utils/openingSchedule";
import { getSingaporeMinutes, getVenueOpenState, type OpenState } from "@/utils/operatingHours";
import type { DietaryFlag, DishDetail, TasteVector, VenueSummary } from "@/types/domain";

/** Decide for Me starts at the first radius and widens one step at a time. */
export const DECIDE_RADIUS_STEPS_METERS = [500, 1000, 2000, 4000];
export const DECIDE_INITIAL_RADIUS_METERS = DECIDE_RADIUS_STEPS_METERS[0];

/** Picks within this many match points are "the same quality"; the food-history mix may swap them. */
export const DECIDE_SCORE_BAND = 5;

/**
 * Dishes ranked by the match the screen shows (`tasteMatchPercent`), nearest then best rated
 * breaking ties. A diner without a trusted taste profile sees "Popular nearby" instead of a
 * number, so those picks rank by rating, then distance. The budget is a preference, not a rule.
 */
export function rankDecideCandidates(
  dishes: DishDetail[],
  options: {
    tasteVector: TasteVector;
    dietaryFlags: DietaryFlag[];
    radiusMeters: number;
    maxDishBudget?: number;
    /** Defaults to "the vector differs from the all-5s guest default". */
    hasTasteProfile?: boolean;
  },
): DishDetail[] {
  const hasTasteProfile = options.hasTasteProfile ?? hasPersonalTasteProfile(options.tasteVector);
  const scoreOf = (dish: DishDetail) =>
    hasTasteProfile
      ? tasteMatchPercent(options.tasteVector, dish.tasteVector)
      : dish.reviewCount > 0
        ? dish.rating
        : 0;
  const ranked = filterSafeDishes(dishes, options.dietaryFlags)
    .filter((dish) => dish.distanceMeters <= options.radiusMeters)
    .map((dish) => ({ dish, score: scoreOf(dish) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.dish.distanceMeters - b.dish.distanceMeters ||
        b.dish.rating - a.dish.rating,
    )
    .map(({ dish }) => dish);
  if (options.maxDishBudget === undefined) return ranked;
  const budget = options.maxDishBudget;
  const withinBudget = ranked.filter((dish) => dish.price <= budget);
  return withinBudget.length ? withinBudget : ranked;
}

/**
 * Keeps a re-ordered list (the food-history mix) from putting a dish above one that matches more
 * than `band` points better: stable sort by score band, so only near-equal picks can swap.
 */
export function keepScoreOrder(
  dishes: DishDetail[],
  scoreOf: (dish: DishDetail) => number,
  band: number = DECIDE_SCORE_BAND,
): DishDetail[] {
  return dishes
    .map((dish, index) => ({ dish, index, tier: Math.floor(scoreOf(dish) / band) }))
    .sort((a, b) => b.tier - a.tier || a.index - b.index)
    .map(({ dish }) => dish);
}

/**
 * Open now in Singapore time, the stall page's rule: a merchant's weekly schedule wins over
 * listed hours. Used by Decide for Me and the zoomed-in map so they agree.
 */
export function getVenueOpenStateNow(venue: VenueSummary, now: Date = new Date()): OpenState {
  return hasWeeklyHours(venue.openingSchedule)
    ? getScheduleOpenState(venue.openingSchedule, venue.isOpen, now)
    : getVenueOpenState(venue.operatingHours, venue.isOpen, now);
}

/** Open now as a yes/no; with no readable hours it falls back to the stall's own flag. */
export function isVenueOpenNow(venue: VenueSummary, now: Date = new Date()): boolean {
  const state = getVenueOpenStateNow(venue, now);
  return state.status === "unknown" ? venue.isOpen : state.status === "open";
}

export interface OpenAwareCandidates {
  candidates: DishDetail[];
  /** True when nothing is open (or unknown) and the picks are closed stalls. */
  onlyClosed: boolean;
  openStateByVenueId: Map<string, OpenState>;
}

/**
 * Prefer stalls that are open now (Singapore time). Stalls with no hours stay
 * eligible after the open ones; closed stalls are used only when nothing else is left.
 */
export function preferOpenStalls(
  dishes: DishDetail[],
  venueById: ReadonlyMap<string, VenueSummary | undefined>,
  now: Date = new Date(),
): OpenAwareCandidates {
  const openStateByVenueId = new Map<string, OpenState>();
  const stateFor = (venueId: string): OpenState => {
    const cached = openStateByVenueId.get(venueId);
    if (cached) return cached;
    const venue = venueById.get(venueId);
    const state: OpenState = venue ? getVenueOpenStateNow(venue, now) : { status: "unknown" };
    openStateByVenueId.set(venueId, state);
    return state;
  };
  const open = dishes.filter((dish) => stateFor(dish.venueId).status === "open");
  const unknown = dishes.filter((dish) => stateFor(dish.venueId).status === "unknown");
  // Closed stalls come back soonest-opening first, so "everything is closed" still leads with
  // the pick that is nearest to opening.
  const closed = dishes
    .filter((dish) => stateFor(dish.venueId).status === "closed")
    .map((dish, index) => ({
      dish,
      index,
      wait: minutesUntilOpening(stateFor(dish.venueId), now),
    }))
    .sort((a, b) => a.wait - b.wait || a.index - b.index)
    .map(({ dish }) => dish);
  const eligible = [...open, ...unknown];
  return eligible.length
    ? { candidates: eligible, onlyClosed: false, openStateByVenueId }
    : { candidates: closed, onlyClosed: closed.length > 0, openStateByVenueId };
}

/** "Opens 7am" / "Opens 5:30pm" as minutes from `now`; Infinity when there is no time to read. */
export function minutesUntilOpening(state: OpenState, now: Date = new Date()): number {
  const match = /opens (\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(state.detail ?? "");
  if (!match) return Number.POSITIVE_INFINITY;
  const hour = (Number(match[1]) % 12) + (match[3].toLowerCase() === "pm" ? 12 : 0);
  const opensAt = hour * 60 + Number(match[2] ?? 0);
  const wait = opensAt - getSingaporeMinutes(now);
  return wait >= 0 ? wait : wait + 24 * 60;
}

/** "Open now · Closes 9pm", "Closed today", "Closed · Opens 7am": never "Closed · Closed today". */
export function formatOpenLabel(state: OpenState | undefined): string | undefined {
  if (!state || state.status === "unknown") return undefined;
  if (state.status === "open") return ["Open now", state.detail].filter(Boolean).join(" · ");
  if (!state.detail) return "Closed";
  return /^closed/i.test(state.detail) ? state.detail : `Closed · ${state.detail}`;
}
