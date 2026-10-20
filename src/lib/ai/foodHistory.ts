/**
 * Food history: what a user has eaten or liked, per dish.
 *
 * Each signal adds a signed weight to the dish's evidence. Evidence decays
 * exponentially (half-life AFFINITY_HALF_LIFE_DAYS) and is shrunk toward zero
 * so one tap never looks like a habit:
 *
 *   score = decayed(evidence) / (AFFINITY_SHRINKAGE + decayed(absEvidence))   in [-1, 1]
 *
 * Decay is applied on write (E_new = E_old * 2^(-dt/h) + w), so the server table
 * user_dish_affinities and this file stay in step without a recompute job.
 * The SQL twin is public.apply_affinity_event (migration 20261020080000).
 */

import type { UserDishAffinity } from "@/types/domain";

export const AFFINITY_HALF_LIFE_DAYS = 90;
export const AFFINITY_SHRINKAGE = 2;
/** A dish at or above this score counts as "liked before". */
export const LIKED_AFFINITY_THRESHOLD = 0.4;
export const DISMISS_DAYS = 30;

/** Evidence per signal. Impressions and searches are never evidence. */
export const AFFINITY_WEIGHTS = {
  review_positive: 4,
  review_neutral: 1,
  review_negative: -3,
  favourite: 3,
  dish_tried: 3,
  dish_like: 2,
  click: 1,
  unsaved: -2,
  dismissed: -4,
} as const;

export type AffinitySignal = keyof typeof AFFINITY_WEIGHTS;

const DAY_MS = 24 * 60 * 60 * 1000;

function decayFactor(fromMs: number, toMs: number): number {
  const days = Math.max(0, (toMs - fromMs) / DAY_MS);
  return Math.pow(2, -days / AFFINITY_HALF_LIFE_DAYS);
}

export interface AffinityEventInput {
  dishId: string;
  signal: AffinitySignal;
  at?: number;
  foodType?: string;
  venueId?: string;
}

/** TS twin of public.apply_affinity_event: decay the row to `at`, then add the signal. */
export function applyAffinityEvent(
  row: UserDishAffinity | undefined,
  event: AffinityEventInput,
): UserDishAffinity {
  const at = event.at ?? Date.now();
  const weight = AFFINITY_WEIGHTS[event.signal];
  const lastMs = row ? Date.parse(row.lastEventAt) : at;
  const factor = row && Number.isFinite(lastMs) ? decayFactor(lastMs, at) : 1;
  const dismissedUntil =
    event.signal === "dismissed"
      ? new Date(at + DISMISS_DAYS * DAY_MS).toISOString()
      : row?.dismissedUntil;
  return {
    dishId: event.dishId,
    foodType: event.foodType ?? row?.foodType,
    venueId: event.venueId ?? row?.venueId,
    evidence: (row?.evidence ?? 0) * factor + weight,
    absEvidence: (row?.absEvidence ?? 0) * factor + Math.abs(weight),
    lastEventAt: new Date(Math.max(at, Number.isFinite(lastMs) ? lastMs : at)).toISOString(),
    dismissedUntil,
  };
}

/** Shrunk, decayed affinity in [-1, 1]. */
export function affinityScore(row: UserDishAffinity, now = Date.now()): number {
  const lastMs = Date.parse(row.lastEventAt);
  const factor = Number.isFinite(lastMs) ? decayFactor(lastMs, now) : 1;
  return (row.evidence * factor) / (AFFINITY_SHRINKAGE + row.absEvidence * factor);
}

export function isDismissed(row: UserDishAffinity, now = Date.now()): boolean {
  return Boolean(row.dismissedUntil && Date.parse(row.dismissedUntil) > now);
}

export function normalizeFoodType(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

/** What ranking needs from history, precomputed once per slate. */
export interface FoodHistory {
  /** dishId -> affinity score */
  dishScores: Map<string, number>;
  /** Dishes hidden after "Not for me" until their dismissal ends */
  dismissedDishIds: Set<string>;
  /** Liked dishes (score >= LIKED_AFFINITY_THRESHOLD) */
  likedDishIds: Set<string>;
  /** Normalised food type -> best liked score for that type */
  likedFoodTypes: Map<string, number>;
  /** Normalised food type -> venues where the user already liked it */
  venuesByFoodType: Map<string, Set<string>>;
}

export function buildFoodHistory(rows: UserDishAffinity[], now = Date.now()): FoodHistory {
  const history: FoodHistory = {
    dishScores: new Map(),
    dismissedDishIds: new Set(),
    likedDishIds: new Set(),
    likedFoodTypes: new Map(),
    venuesByFoodType: new Map(),
  };
  for (const row of rows) {
    const score = affinityScore(row, now);
    history.dishScores.set(row.dishId, score);
    if (isDismissed(row, now)) history.dismissedDishIds.add(row.dishId);
    if (score < LIKED_AFFINITY_THRESHOLD) continue;
    history.likedDishIds.add(row.dishId);
    const foodType = normalizeFoodType(row.foodType);
    if (!foodType) continue;
    history.likedFoodTypes.set(
      foodType,
      Math.max(score, history.likedFoodTypes.get(foodType) ?? 0),
    );
    if (row.venueId) {
      const venues = history.venuesByFoodType.get(foodType) ?? new Set<string>();
      venues.add(row.venueId);
      history.venuesByFoodType.set(foodType, venues);
    }
  }
  return history;
}

export function hasLikedHistory(history: FoodHistory | undefined): history is FoodHistory {
  return Boolean(history && history.likedDishIds.size > 0);
}

type DishLookup = (dishId: string) => { foodTypeTag?: string; venueId: string } | undefined;

/**
 * History from what the phone already knows (favourites, reviewed dishes). Used for
 * guests and as a fallback until the server history loads.
 */
export function deriveLocalFoodHistory(
  profile: { favouriteDishIds: string[]; reviewedDishIds: string[] },
  lookup: DishLookup,
  now = Date.now(),
): UserDishAffinity[] {
  const rows = new Map<string, UserDishAffinity>();
  const add = (dishId: string, signal: AffinitySignal) => {
    const dish = lookup(dishId);
    rows.set(
      dishId,
      applyAffinityEvent(rows.get(dishId), {
        dishId,
        signal,
        at: now,
        foodType: dish?.foodTypeTag,
        venueId: dish?.venueId,
      }),
    );
  };
  for (const dishId of new Set(profile.reviewedDishIds)) add(dishId, "dish_tried");
  for (const dishId of new Set(profile.favouriteDishIds)) add(dishId, "favourite");
  return [...rows.values()];
}

/** Server rows win per dish; local rows fill dishes the server does not know yet. */
export function mergeFoodHistory(
  serverRows: UserDishAffinity[],
  localRows: UserDishAffinity[],
): UserDishAffinity[] {
  const merged = new Map(localRows.map((row) => [row.dishId, row]));
  for (const row of serverRows) merged.set(row.dishId, row);
  return [...merged.values()];
}
