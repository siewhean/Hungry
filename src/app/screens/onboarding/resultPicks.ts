import { NEUTRAL_TASTE_VECTOR, TASTE_DIMENSIONS } from "@/constants/taste";
import type { DietaryFlag, TasteVector } from "@/types/domain";

/**
 * "You lean spicy and rich": the strongest answers above neutral. When nothing is above
 * neutral but something is below it, the user chose the light answers, which is not the
 * same as "balanced".
 */
export function describeTaste(vector: TasteVector): string | null {
  const leaning = TASTE_DIMENSIONS.filter(
    (dimension) => vector[dimension.key] > NEUTRAL_TASTE_VECTOR[dimension.key],
  )
    .sort((left, right) => vector[right.key] - vector[left.key])
    .slice(0, 2)
    .map((dimension) => dimension.label.toLowerCase());
  if (leaning.length > 0) return `You lean ${leaning.join(" and ")}.`;
  const keepsLight = TASTE_DIMENSIONS.some(
    (dimension) => vector[dimension.key] < NEUTRAL_TASTE_VECTOR[dimension.key],
  );
  return keepsLight ? "You keep things light and mild." : "You like your flavours balanced.";
}

/** A dish suits the diet only when it carries every requested flag (halal and vegan means both). */
export function matchesAllDietaryFlags(
  dish: { dietaryFlags?: readonly string[] },
  flags: readonly DietaryFlag[],
): boolean {
  if (flags.length === 0) return true;
  const carried = dish.dietaryFlags ?? [];
  return flags.every((flag) => carried.includes(flag));
}

/** "gluten_free" -> "gluten free", for a sentence. */
export function dietaryFlagWords(flag: DietaryFlag): string {
  return flag.replace(/_/g, " ");
}

/** Shown instead of dishes when nothing tagged for the user's diet could be found. */
export function noDietaryPicksMessage(flags: readonly DietaryFlag[]): string {
  const words = flags.slice(0, 2).map(dietaryFlagWords).join(" and ");
  return `We don't have many ${words} dishes tagged yet. Browse Home to see what's nearby.`;
}
