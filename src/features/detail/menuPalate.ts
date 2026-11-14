import { tasteMatchPercent } from "@/lib/ai/tasteEngine";
import { tasteTrust } from "@/lib/ai/tasteTrust";
import type { DishDetail, TasteVector } from "@/types/domain";

/** A menu dish this close to the diner's palate is tagged "Likely a match". */
export const LIKELY_MATCH_MIN_PERCENT = 70;
/**
 * The menu dishes that are likely a match for the diner. Empty without a trusted palate.
 * "Likely a match" is a reason, not a percentage, so an estimated taste (the menu workbook's
 * baseline) may earn it; a dish whose taste is unknown never does (see tasteTrust).
 */
export function likelyMatchDishIds(
  dishes: readonly Pick<DishDetail, "id" | "tasteVector" | "tasteConfidence">[],
  palate: TasteVector | null,
): Set<string> {
  const ids = new Set<string>();
  if (!palate) return ids;
  for (const dish of dishes) {
    if (tasteTrust(dish) === "unknown") continue;
    if (tasteMatchPercent(palate, dish.tasteVector) >= LIKELY_MATCH_MIN_PERCENT) ids.add(dish.id);
  }
  return ids;
}
