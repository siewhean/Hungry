import type { DietaryFlag } from "@/types/domain";

const DIETARY_LABELS: Partial<Record<DietaryFlag, string>> = {
  halal: "Halal",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pork_free: "Pork-free",
  nut_free: "Nut-free",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  egg_free: "Egg-free",
  peanut_free: "Peanut-free",
  shellfish_free: "Shellfish-free",
  soy_free: "Soy-free",
  sesame_free: "Sesame-free",
  pescatarian: "Pescatarian",
  kosher: "Kosher",
  keto: "Keto",
  paleo: "Paleo",
  low_carb: "Low-carb",
  low_sodium: "Low-sodium",
};

/** Halal and vegetarian decide whether many diners can eat a dish at all, so they lead. */
const PRIORITY: DietaryFlag[] = ["halal", "vegetarian", "vegan", "pork_free"];

export function formatDietaryFlag(flag: string): string {
  const known = DIETARY_LABELS[flag as DietaryFlag];
  if (known) return known;
  const words = flag.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Unique flags, halal/vegetarian/vegan/pork-free first, then alphabetical by label. */
export function orderDietaryFlags(flags: readonly string[]): string[] {
  const unique = Array.from(new Set(flags.filter((flag) => flag.trim().length > 0)));
  return unique.sort((left, right) => {
    const leftRank = PRIORITY.indexOf(left as DietaryFlag);
    const rightRank = PRIORITY.indexOf(right as DietaryFlag);
    if (leftRank !== rightRank) {
      return (
        (leftRank === -1 ? PRIORITY.length : leftRank) -
        (rightRank === -1 ? PRIORITY.length : rightRank)
      );
    }
    return formatDietaryFlag(left).localeCompare(formatDietaryFlag(right));
  });
}

export interface StallDietarySummaryItem {
  flag: string;
  label: string;
  dishCount: number;
  /** Every listed dish carries the flag. */
  allDishes: boolean;
}

/** Stall-level summary: which labels appear on the menu and on how many dishes. */
export function summarizeStallDietaryFlags(
  dishes: readonly { dietaryFlags?: readonly string[] }[],
): StallDietarySummaryItem[] {
  const counts = new Map<string, number>();
  for (const dish of dishes) {
    for (const flag of new Set(dish.dietaryFlags ?? [])) {
      counts.set(flag, (counts.get(flag) ?? 0) + 1);
    }
  }
  return orderDietaryFlags(Array.from(counts.keys())).map((flag) => {
    const dishCount = counts.get(flag) ?? 0;
    return {
      flag,
      label: formatDietaryFlag(flag),
      dishCount,
      allDishes: dishes.length > 0 && dishCount === dishes.length,
    };
  });
}
