/**
 * Pure rules for the dish rails on Home: palate order with a reason line, and one rail per
 * dish. The screen passes the bites and dishes it already holds; nothing here reads a service.
 */
import { rankForYou } from "@/features/discover/mallMode";
import { hasPersonalTasteProfile } from "@/lib/ai/tasteEngine";
import type { Bite } from "@/lib/services/types";
import type { DietaryFlag, DishDetail, TasteVector } from "@/types/domain";

export type TasteOrderOptions = {
  tasteVector: TasteVector;
  dietaryFlags: DietaryFlag[];
  maxDishBudget?: number;
  preferBuildingId?: string;
};

/**
 * The bites in the diner's palate order, each with a one-line reason ("Spicy, the way you like
 * it"). A dietary need is a hard rule, so the dishes the ranking drops are left out; a bite
 * whose dish is not loaded cannot be judged and follows the ranked ones. A diner with no palate
 * yet keeps the old order and gets no reasons: there is nothing to rank by.
 */
export function tasteOrderBites(
  bites: readonly Bite[],
  dishById: ReadonlyMap<string, DishDetail>,
  options: TasteOrderOptions,
): { bites: Bite[]; reasons: Map<string, string> } {
  if (!hasPersonalTasteProfile(options.tasteVector)) {
    return { bites: [...bites], reasons: new Map() };
  }
  const dishes = bites.flatMap((bite) => {
    const dish = dishById.get(bite.dishId);
    return dish ? [dish] : [];
  });
  const picks = rankForYou(dishes, { ...options, limit: dishes.length });
  const rankByDishId = new Map(picks.map((pick, index) => [pick.dish.id, index] as const));
  const ranked = bites
    .filter((bite) => rankByDishId.has(bite.dishId))
    .sort((a, b) => rankByDishId.get(a.dishId)! - rankByDishId.get(b.dishId)!);
  const unjudged = bites.filter((bite) => !dishById.has(bite.dishId));
  return {
    bites: [...ranked, ...unjudged],
    reasons: new Map(picks.map((pick) => [pick.dish.id, pick.reason] as const)),
  };
}

/**
 * Cuts each rail to its size, in on-screen order, without repeating a dish already shown in an
 * earlier rail. A rail the repeats leave thin is left thin, and the screen hides a rail too short
 * to look like one, unless it is marked `keepWhenThin`: the main rail then keeps its dishes
 * (a small area has few) rather than vanish.
 */
export function pickRailsWithoutRepeats(
  rails: readonly { bites: readonly Bite[]; max: number; keepWhenThin?: boolean }[],
  minItems: number,
): Bite[][] {
  const seen = new Set<string>();
  return rails.map(({ bites, max, keepWhenThin }) => {
    const fresh = bites.filter((bite) => !seen.has(bite.dishId));
    const thin = fresh.length < Math.min(minItems, bites.length);
    const shown = (keepWhenThin && thin ? [...bites] : fresh).slice(0, max);
    for (const bite of shown) seen.add(bite.dishId);
    return shown;
  });
}
