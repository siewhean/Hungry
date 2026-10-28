import { TASTE_DIMENSIONS } from "@/constants/taste";
import { perceivedTasteRows } from "@/features/detail/perceivedTaste";
import type { TasteVector } from "@/types/domain";

/** An axis the dish must reach before a chip talks about it. */
const NOTICEABLE = 3;
/** A dish axis this strong, for a person who likes the axis this much, is a reason to pick it. */
const DISH_STRONG = 6;
const PERSON_LIKES = 7;

const lower = (label: string) => label.toLowerCase();

/**
 * Up to two short chips on a swipe card: how the dish will feel to this person on its strongest
 * axes, for example "More spicy for you". The sliders' answers drive it; no chip is made up when
 * the dish has no taste tags.
 */
export function dishFitChips(
  dishVector: TasteVector | undefined,
  userVector: TasteVector | undefined,
  max = 2,
): string[] {
  return perceivedTasteRows(dishVector, userVector)
    .filter((row) => row.standard >= NOTICEABLE)
    .slice(0, max)
    .map((row) => {
      const axis = lower(row.label);
      if (row.direction === "stronger") return `More ${axis} for you`;
      if (row.direction === "milder") return `Gentler ${axis} for you`;
      return `Just your ${axis}`;
    });
}

/** Why a result was picked: the axes where the dish is strong and the person said they like it. */
export function dishReasonChips(
  dishVector: TasteVector | undefined,
  userVector: TasteVector | undefined,
  max = 3,
): string[] {
  if (!dishVector || !userVector) return [];
  return TASTE_DIMENSIONS.filter(
    (dimension) =>
      (dishVector[dimension.key] ?? 0) >= DISH_STRONG &&
      (userVector[dimension.key] ?? 5) >= PERSON_LIKES,
  )
    .slice(0, max)
    .map((dimension) => `You like ${lower(dimension.label)}`);
}
