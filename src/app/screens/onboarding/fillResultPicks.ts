import type { DietaryFlag } from "@/types/domain";
import { dietaryFlagWords, matchesAllDietaryFlags } from "./resultPicks";

/** A dish with no listed price (0) is kept: an unknown price is not a reason to hide a dish. */
function withinBudget(dish: { price: number }, maxDishBudget: number | undefined): boolean {
  return maxDishBudget === undefined || dish.price <= 0 || dish.price <= maxDishBudget;
}

export interface ResultPick<T> {
  dish: T;
  /** True for a dish added to fill the grid ("Popular on Hungry"), false for a taste match. */
  popular: boolean;
}

/**
 * The first-picks grid: taste matches first, then popular dishes nearby until `count` cards
 * are shown. Every dish must carry the diet and fit the budget, so a halal user never sees a
 * non-halal dish and a S$6 budget never shows a S$8 plate. A dish never appears twice.
 */
export function buildResultPicks<
  T extends { id: string; price: number; dietaryFlags?: readonly string[] },
>({
  ranked,
  popular,
  count,
  dietaryFlags,
  maxDishBudget,
}: {
  ranked: readonly T[];
  popular: readonly T[];
  count: number;
  dietaryFlags: readonly DietaryFlag[];
  maxDishBudget: number | undefined;
}): ResultPick<T>[] {
  const fits = (dish: T) =>
    matchesAllDietaryFlags(dish, dietaryFlags) && withinBudget(dish, maxDishBudget);
  const picks: ResultPick<T>[] = [];
  const seen = new Set<string>();
  for (const dish of ranked) {
    if (picks.length >= count) break;
    if (seen.has(dish.id) || !fits(dish)) continue;
    seen.add(dish.id);
    picks.push({ dish, popular: false });
  }
  for (const dish of popular) {
    if (picks.length >= count) break;
    if (seen.has(dish.id) || !fits(dish)) continue;
    seen.add(dish.id);
    picks.push({ dish, popular: true });
  }
  return picks;
}

/** Shown under a short grid: the diet left fewer dishes than there are slots, which is not a bug. */
export function fewDietaryPicksMessage(flags: readonly DietaryFlag[], shown: number): string {
  const words = flags.slice(0, 2).map(dietaryFlagWords).join(" and ");
  const dishes = shown === 1 ? "1 dish" : `${shown} dishes`;
  return `Only ${dishes} tagged ${words} so far. More appear on Home as stalls add them.`;
}
