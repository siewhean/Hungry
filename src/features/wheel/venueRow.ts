/** A stall counts as a "best match" at or above this taste match percentage (0-100). */
export const BEST_MATCH_PERCENT = 80;

/** Joins the parts that exist, so a missing floor, unit or tag never leaves a stray separator. */
export function joinVenueSubtitle(parts: readonly (string | null | undefined)[]): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" • ");
}

/**
 * Taste match of a stall: its best dish, not just the first one. Dishes without a
 * taste signal are skipped, so an untagged first dish cannot hide a good match.
 */
export function bestDishMatchPercent<T>(
  dishes: readonly T[],
  matchPercent: (dish: T) => number,
  hasTasteSignal: (dish: T) => boolean,
): number {
  let best = 0;
  for (const dish of dishes) {
    if (!hasTasteSignal(dish)) continue;
    best = Math.max(best, matchPercent(dish));
  }
  return best;
}
