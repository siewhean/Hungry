import { TASTE_DIMENSIONS } from "@/constants/taste";
import type { DishTasteRatingSummary, TasteVector } from "@/types/domain";

/** What the taste card shows once diners have rated: the shape, who it comes from, how many. */
export type DinerTaste = {
  /** Averages per axis (0-10). An axis with fewer than 3 raters is not in the summary. */
  levels: Partial<TasteVector>;
  /** Largest number of diners behind any axis: the "From N diners" line. */
  raters: number;
};

/** The summary as chart input, or undefined while no axis has enough raters. */
export function dinerTasteFromSummary(
  summary: DishTasteRatingSummary | undefined,
): DinerTaste | undefined {
  if (!summary) return undefined;
  const levels: Partial<TasteVector> = {};
  let raters = 0;
  for (const dimension of TASTE_DIMENSIONS) {
    const axis = summary[dimension.key];
    if (!axis || !Number.isFinite(axis.average) || axis.raters <= 0) continue;
    levels[dimension.key] = Math.max(0, Math.min(10, axis.average));
    raters = Math.max(raters, axis.raters);
  }
  return raters > 0 ? { levels, raters } : undefined;
}

/**
 * The dish's standard level per axis for "how it tastes to you": what diners rated where they
 * did, the catalog estimate everywhere else.
 */
export function blendDinerTaste(
  estimate: TasteVector,
  diners: DinerTaste | undefined,
): TasteVector {
  if (!diners) return estimate;
  return { ...estimate, ...diners.levels };
}

/** "From 1 diner" / "From 12 diners": the legend under the chart. */
export function dinerTasteLabel(raters: number): string {
  return `From ${raters} ${raters === 1 ? "diner" : "diners"}`;
}
