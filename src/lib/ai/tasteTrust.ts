import type { DishSummary, TasteVector } from "@/types/domain";

/**
 * One rule for how far a dish's taste tags are trusted, used by every surface that ranks,
 * learns from or shows a dish's taste.
 *
 * - verified: tagged with confidence 0.7 or more (the AI tagger's auto-apply cut-off, or a
 *   dish with no confidence recorded). Full weight, and a match percentage may be shown.
 * - estimated: some confidence below 0.7, such as the menu workbook's category baseline (0.3).
 *   Ranked and learned from at its confidence, and shown only as a reason ("Likely your
 *   taste"), never as a percentage.
 * - unknown: confidence 0 or the all-5 placeholder. Ignored for taste.
 */
export type TasteTrust = "verified" | "estimated" | "unknown";

export const VERIFIED_TASTE_CONFIDENCE = 0.7;

type DishTaste = Pick<DishSummary, "tasteVector" | "tasteConfidence">;

const NEUTRAL = 5;

function isPlaceholder(vector: TasteVector | undefined | null): boolean {
  if (!vector) return true;
  return (Object.keys(vector) as (keyof TasteVector)[]).every((key) => vector[key] === NEUTRAL);
}

function clampedConfidence(dish: DishTaste): number {
  return Math.min(1, Math.max(0, dish.tasteConfidence ?? 1));
}

export function tasteTrust(dish: DishTaste): TasteTrust {
  const confidence = clampedConfidence(dish);
  if (confidence <= 0 || isPlaceholder(dish.tasteVector)) return "unknown";
  return confidence >= VERIFIED_TASTE_CONFIDENCE ? "verified" : "estimated";
}

/** 0 to 1: how much of a taste score this dish's tags carry. Verified 1, estimated its confidence. */
export function tasteWeight(dish: DishTaste): number {
  const trust = tasteTrust(dish);
  if (trust === "unknown") return 0;
  return trust === "verified" ? 1 : clampedConfidence(dish);
}

/** A taste match percentage is shown only for a verified dish. */
export function canShowTastePercent(dish: DishTaste): boolean {
  return tasteTrust(dish) === "verified";
}
