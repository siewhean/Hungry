/**
 * Pure rules for what a diner just told Home, without leaving the page:
 *  - "Not for me" hides a dish (the profile store keeps it hidden for 30 days) and
 *    "Show less of this food" moves a food type to the end of every rail for 30 days.
 *  - Actions in the last half hour (a dish opened, saved or hidden) nudge the palate Home
 *    ranks by for this visit only. The stable palate is never touched here.
 *  - A match percentage is shown only when both the profile and the dish tags can be trusted.
 * The screen passes what it already holds; nothing here reads a service or a store.
 */
import { isNeutralTasteVector } from "@/lib/ai/tasteEngine";
import type { Bite } from "@/lib/services/types";
import type { DishSummary, TasteVector } from "@/types/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long "Show less of this food" lasts. */
export const MUTE_FOOD_TYPE_MS = 30 * DAY_MS;
/** Session actions older than this no longer move the palate. */
export const SESSION_WINDOW_MS = 30 * 60 * 1000;
/** Only the latest actions count, so one long browse cannot swamp the palate. */
export const SESSION_ACTION_LIMIT = 10;
/** The most one axis can move for this visit. */
export const SESSION_SHIFT_MAX = 3;
/** A dish tagged with less confidence than this does not show a match percentage. */
export const MATCH_PERCENT_MIN_CONFIDENCE = 0.7;

export type SessionActionKind = "open" | "save" | "hide";

export interface SessionAction {
  dishId: string;
  kind: SessionActionKind;
  /** Milliseconds since epoch. */
  at: number;
}

export interface MutedFoodType {
  /** Lower-case food type, as `normalizeFoodType` makes it. */
  foodType: string;
  /** Milliseconds since epoch when the muting ends. */
  until: number;
}

/** How far one action pulls the palate toward (or, for hide, away from) the dish. */
const ACTION_PULL: Record<SessionActionKind, number> = {
  open: 0.2,
  save: 0.4,
  hide: -0.4,
};

const TASTE_AXES: (keyof TasteVector)[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];

const ZERO_SHIFT: TasteVector = { sweet: 0, spicy: 0, sour: 0, salty: 0, rich: 0, aromatic: 0 };

type DishTaste = Pick<DishSummary, "tasteVector" | "tasteConfidence">;

/**
 * How far this visit's actions move each taste axis, from -3 to 3. Each recent action pulls the
 * palate toward the dish it was about (away for a hide), scaled by how sure we are of the dish's
 * tags. A dish with no taste data (or the all-5 placeholder) moves nothing.
 */
export function sessionShift(
  actions: readonly SessionAction[],
  userVector: TasteVector,
  lookup: (dishId: string) => DishTaste | undefined,
  now = Date.now(),
): TasteVector {
  const recent = actions
    .filter((action) => now - action.at >= 0 && now - action.at <= SESSION_WINDOW_MS)
    .slice(-SESSION_ACTION_LIMIT);
  const shift: TasteVector = { ...ZERO_SHIFT };
  for (const action of recent) {
    const dish = lookup(action.dishId);
    if (!dish || isNeutralTasteVector(dish.tasteVector)) continue;
    const confidence = Math.min(1, Math.max(0, dish.tasteConfidence ?? 1));
    for (const axis of TASTE_AXES) {
      shift[axis] +=
        ACTION_PULL[action.kind] * confidence * (dish.tasteVector[axis] - userVector[axis]);
    }
  }
  for (const axis of TASTE_AXES) {
    shift[axis] = Math.min(SESSION_SHIFT_MAX, Math.max(-SESSION_SHIFT_MAX, shift[axis]));
  }
  return shift;
}

/** The palate to rank by for this visit: the stable one plus the shift, kept on the 0 to 10 scale. */
export function applySessionShift(userVector: TasteVector, shift: TasteVector): TasteVector {
  const next = { ...userVector };
  for (const axis of TASTE_AXES) {
    next[axis] = Math.min(10, Math.max(0, userVector[axis] + shift[axis]));
  }
  return next;
}

/** Muted food types whose time is not up. */
export function activeMutedFoodTypes(
  muted: readonly MutedFoodType[],
  now = Date.now(),
): MutedFoodType[] {
  return muted.filter((item) => item.until > now);
}

/**
 * Takes hidden dishes out of a rail and moves muted food types to its end. Nothing else
 * changes order, and a muted dish is demoted rather than removed: "show less" is not "never".
 */
export function applyFeedbackToBites(
  bites: readonly Bite[],
  options: {
    dismissedDishIds: ReadonlySet<string>;
    mutedFoodTypes: ReadonlySet<string>;
    foodTypeOf: (dishId: string) => string | undefined;
  },
): Bite[] {
  const kept = bites.filter((bite) => !options.dismissedDishIds.has(bite.dishId));
  if (options.mutedFoodTypes.size === 0) return kept;
  const isMuted = (bite: Bite) => {
    const foodType = options.foodTypeOf(bite.dishId);
    return foodType !== undefined && options.mutedFoodTypes.has(foodType);
  };
  return [...kept.filter((bite) => !isMuted(bite)), ...kept.filter(isMuted)];
}

/**
 * A match percentage is an estimate, so it appears only when the diner's profile is trusted and
 * the dish's taste tags are confident (a dish with no confidence recorded counts as trusted,
 * as in the ranking). Otherwise the card shows its reason line alone.
 */
export function shouldShowMatchPercent(options: {
  profileTrusted: boolean;
  dishConfidence?: number;
}): boolean {
  if (!options.profileTrusted) return false;
  return (options.dishConfidence ?? 1) >= MATCH_PERCENT_MIN_CONFIDENCE;
}
