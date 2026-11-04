import { hasDishTasteSignal, tasteMatchPercent } from "@/lib/ai/tasteEngine";
import type { DishDetail, TasteVector } from "@/types/domain";

/** A menu dish this close to the diner's palate is tagged "Likely a match". */
export const LIKELY_MATCH_MIN_PERCENT = 70;
/** Tagger confidence a dish needs before its taste is trusted on a menu (the apply cut-off). */
export const LIKELY_MATCH_MIN_CONFIDENCE = 0.5;

/**
 * The menu dishes that are likely a match for the diner. Empty without a trusted palate, and
 * dishes whose taste is unknown or a low-confidence guess are never tagged.
 */
export function likelyMatchDishIds(
  dishes: readonly Pick<DishDetail, "id" | "tasteVector" | "tasteConfidence">[],
  palate: TasteVector | null,
): Set<string> {
  const ids = new Set<string>();
  if (!palate) return ids;
  for (const dish of dishes) {
    if (!hasDishTasteSignal(dish)) continue;
    if ((dish.tasteConfidence ?? 1) < LIKELY_MATCH_MIN_CONFIDENCE) continue;
    if (tasteMatchPercent(palate, dish.tasteVector) >= LIKELY_MATCH_MIN_PERCENT) ids.add(dish.id);
  }
  return ids;
}
