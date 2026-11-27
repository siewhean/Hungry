/** Pure helpers for the filter chips on Home. */
import { formatDietaryFlag, orderDietaryFlags } from "@/features/detail/dietaryLabels";

/** The most a "Under S$5" dish can cost. */
export const HOME_CHEAP_PRICE_LIMIT = 5;
const DIETARY_CHIP_LABEL_COUNT = 2;

/**
 * The saved needs in words ("Halal · Vegetarian +1", or "Beef free"): halal and vegetarian
 * first, with a count for the rest. Empty when none are saved.
 */
export function describeDietaryNeeds(dietaryPreferences: readonly string[]): string {
  const flags = orderDietaryFlags(dietaryPreferences);
  const shown = flags.slice(0, DIETARY_CHIP_LABEL_COUNT).map(formatDietaryFlag);
  const hidden = flags.length - shown.length;
  return `${shown.join(" · ")}${hidden > 0 ? ` +${hidden}` : ""}`;
}

/**
 * The first chip is always "Dietary needs": it applies everything the diner saved (no beef,
 * halal, ...), so a saved need never shows up as a chip of its own.
 */
export function getDietaryChipLabel(_dietaryPreferences?: readonly string[]): string {
  return "Dietary needs";
}

/** What a screen reader hears for the chip: the label, then what it is applying. */
export function getDietaryChipA11yLabel(dietaryPreferences: readonly string[]): string {
  const needs = describeDietaryNeeds(dietaryPreferences);
  return needs ? `Dietary needs: ${needs}` : "Dietary needs";
}
