/** Pure helpers for the filter chips on Home. */
import { formatDietaryFlag, orderDietaryFlags } from "@/features/detail/dietaryLabels";

/** The most a "Under S$5" dish can cost. */
export const HOME_CHEAP_PRICE_LIMIT = 5;
const DIETARY_CHIP_LABEL_COUNT = 2;

/** "Dietary needs" until the diner saves some; then the needs themselves ("Halal · Vegetarian"). */
export function getDietaryChipLabel(dietaryPreferences: readonly string[]): string {
  const flags = orderDietaryFlags(dietaryPreferences);
  if (flags.length === 0) return "Dietary needs";
  const shown = flags.slice(0, DIETARY_CHIP_LABEL_COUNT).map(formatDietaryFlag);
  const hidden = flags.length - shown.length;
  return `${shown.join(" · ")}${hidden > 0 ? ` +${hidden}` : ""}`;
}
