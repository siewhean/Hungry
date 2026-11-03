/**
 * Which Home chips suit this diner right now: no breakfast chip at dinner, no spicy chip for
 * someone who cannot take spice, and the foods they know first. Pure.
 */
import { classifyHomeText, type HomeCategoryId } from "@/features/discover/homeCategories";
import type { DietaryFlag, TasteVector } from "@/types/domain";

/** Singapore hours [from, to) in which a food-kind chip is offered; none means all day. */
const CHIP_HOURS: Partial<Record<HomeCategoryId, readonly (readonly [number, number])[]>> = {
  breakfast: [[5, 11]],
  drinks: [
    [5, 11],
    [14, 18],
  ],
  dessert: [[14, 23]],
  noodles: [[6, 23]],
  rice: [[10, 22]],
  soup: [
    [0, 3],
    [6, 10],
    [17, 24],
  ],
  western: [[11, 22]],
};

/** A spice level from this up is "hot" in the quiz and the learned palate. */
const CANNOT_TAKE_SPICE_AT_OR_BELOW = 2;

export function isChipInSeason(id: string, hour: number): boolean {
  const windows = CHIP_HOURS[id as HomeCategoryId];
  if (!windows) return true;
  return windows.some(([from, to]) => hour >= from && hour < to);
}

/** True when the quiz or what the diner has done says they stay away from spice. */
export function cannotTakeSpice(profile: {
  tasteVector: Pick<TasteVector, "spicy">;
  tasteProfile?: { spiceSeeking: number };
}): boolean {
  const seeking = profile.tasteProfile?.spiceSeeking;
  if (seeking !== undefined && seeking <= CANNOT_TAKE_SPICE_AT_OR_BELOW) return true;
  return profile.tasteVector.spicy <= CANNOT_TAKE_SPICE_AT_OR_BELOW;
}

export type HomeChipContext = {
  hour: number;
  avoidSpicy: boolean;
  dietaryPreferences: readonly DietaryFlag[];
  /** Food kinds the diner has had or pinned: their chips come first. */
  knownKinds: ReadonlySet<HomeCategoryId>;
  /** Chips that are on stay in the row so they can be turned off. */
  activeIds: ReadonlySet<string>;
};

/** The food kinds named by dish names, for `knownKinds`. */
export function kindsOfNames(names: readonly string[]): Set<HomeCategoryId> {
  const kinds = new Set<HomeCategoryId>();
  for (const name of names) {
    const kind = classifyHomeText(name);
    if (kind) kinds.add(kind);
  }
  return kinds;
}

/**
 * Keeps the chips that fit this diner at this hour and puts the likelier ones first. The order
 * of the rest is unchanged. "dietary" and "late" are placed by the caller.
 */
export function fitChipsToDiner<T extends { id: string }>(
  chips: readonly T[],
  context: HomeChipContext,
): T[] {
  const needsMeatFree = context.dietaryPreferences.some(
    (flag) => flag === "vegetarian" || flag === "vegan",
  );
  const kept = chips.filter((chip) => {
    if (context.activeIds.has(chip.id)) return true;
    if (chip.id === "spicy") return !context.avoidSpicy;
    // The dietary chip already says "Vegetarian" for someone who saved that need.
    if (chip.id === "vegetarian") return !needsMeatFree;
    return isChipInSeason(chip.id, context.hour);
  });
  const rank = (chip: T) => (context.knownKinds.has(chip.id as HomeCategoryId) ? 0 : 1);
  // Array.prototype.sort is stable, so equal ranks keep their order.
  return [...kept].sort((a, b) => rank(a) - rank(b));
}
