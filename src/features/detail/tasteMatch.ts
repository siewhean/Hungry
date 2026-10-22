import type { TasteVector } from "@/types/domain";

/** The neutral taste value: a vector of all 5s says nothing about taste. */
const NEUTRAL = 5;

const KEYS: (keyof TasteVector)[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];

/**
 * 0-100 match between a diner's taste and a dish. Both vectors are centred on
 * the neutral 5 first: with all-positive 0-10 values plain cosine similarity
 * rarely drops under ~75%, so every tagged dish looked like a strong match.
 * Identical tastes give 100, unrelated 50, opposite 0.
 */
export function tasteMatchPercent(left: TasteVector, right: TasteVector): number {
  let dot = 0;
  let leftSquares = 0;
  let rightSquares = 0;
  for (const key of KEYS) {
    const a = (left[key] ?? NEUTRAL) - NEUTRAL;
    const b = (right[key] ?? NEUTRAL) - NEUTRAL;
    dot += a * b;
    leftSquares += a * a;
    rightSquares += b * b;
  }
  if (leftSquares === 0 || rightSquares === 0) return 50;
  const cosine = dot / Math.sqrt(leftSquares * rightSquares);
  return Math.round(((Math.max(-1, Math.min(1, cosine)) + 1) / 2) * 100);
}

/** Words instead of a number: the match is an estimate, not a measurement. */
export function tasteMatchLabel(percent: number): string {
  if (percent >= 75) return "Close to your taste";
  if (percent >= 40) return "Some overlap";
  return "Different from your usual";
}
