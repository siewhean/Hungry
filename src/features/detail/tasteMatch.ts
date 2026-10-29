import { tasteMatchPercent as engineTasteMatchPercent } from "@/lib/ai/tasteEngine";
import type { TasteVector } from "@/types/domain";

/**
 * 0-100 match between a diner's taste and a dish: the same score Decide for Me ranks by and
 * the "Palate match" bars add up to (see the engine's `tasteMatchPercent`).
 */
export const tasteMatchPercent = (left: TasteVector, right: TasteVector): number =>
  engineTasteMatchPercent(left, right);

/** Words instead of a number: the match is an estimate, not a measurement. */
export function tasteMatchLabel(percent: number): string {
  if (percent >= 75) return "Close to your taste";
  if (percent >= 40) return "Some overlap";
  return "Different from your usual";
}
