import { runRecommendationPipeline } from "@/lib/ai/tasteEngine";
import { getScheduleOpenState, hasWeeklyHours } from "@/utils/openingSchedule";
import { getVenueOpenState, type OpenState } from "@/utils/operatingHours";
import type { DietaryFlag, DishDetail, TasteVector, VenueSummary } from "@/types/domain";

/** Decide for Me starts at the first radius and widens one step at a time. */
export const DECIDE_RADIUS_STEPS_METERS = [500, 1000, 2000, 4000];
export const DECIDE_INITIAL_RADIUS_METERS = DECIDE_RADIUS_STEPS_METERS[0];

/** Taste-ranked dishes, with the budget treated as a preference rather than a hard rule. */
export function rankDecideCandidates(
  dishes: DishDetail[],
  options: {
    tasteVector: TasteVector;
    dietaryFlags: DietaryFlag[];
    radiusMeters: number;
    maxDishBudget?: number;
  },
): DishDetail[] {
  const byId = new Map(dishes.map((dish) => [dish.id, dish]));
  const ranked = runRecommendationPipeline(dishes, {
    userVector: options.tasteVector,
    dietaryFlags: options.dietaryFlags,
    radiusMeters: options.radiusMeters,
    neophiliaIndex: 5,
  })
    .map((result) => byId.get(result.dishId))
    .filter((dish): dish is DishDetail => Boolean(dish));
  if (options.maxDishBudget === undefined) return ranked;
  const budget = options.maxDishBudget;
  const withinBudget = ranked.filter((dish) => dish.price <= budget);
  return withinBudget.length ? withinBudget : ranked;
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
  const closed = dishes.filter((dish) => stateFor(dish.venueId).status === "closed");
  const eligible = [...open, ...unknown];
  return eligible.length
    ? { candidates: eligible, onlyClosed: false, openStateByVenueId }
    : { candidates: closed, onlyClosed: closed.length > 0, openStateByVenueId };
}
