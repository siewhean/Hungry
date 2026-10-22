import { NEUTRAL_TASTE_VECTOR, TASTE_DIMENSIONS } from "@/constants/taste";
import type { TasteVector } from "@/types/domain";

/** A taste must sit at least this far from neutral (0-10 scale) to count as a signal. */
export const TASTE_LEAN_THRESHOLD = 1;

export const TASTE_NOT_BUILT_SUMMARY = "Rate and save dishes to build your Taste Fingerprint.";

function distanceFromNeutral(vector: TasteVector, key: keyof TasteVector) {
  return (vector[key] ?? NEUTRAL_TASTE_VECTOR[key]) - NEUTRAL_TASTE_VECTOR[key];
}

/** True once any taste differs clearly from the neutral baseline a new or quiz-skipping user has. */
export function hasTasteSignal(vector: TasteVector): boolean {
  return TASTE_DIMENSIONS.some(
    (dimension) => Math.abs(distanceFromNeutral(vector, dimension.key)) >= TASTE_LEAN_THRESHOLD,
  );
}

/** Up to `count` tastes the user clearly leans towards, strongest first. */
export function topTasteLeans(vector: TasteVector, count: number) {
  return TASTE_DIMENSIONS.filter(
    (dimension) => distanceFromNeutral(vector, dimension.key) >= TASTE_LEAN_THRESHOLD,
  )
    .map((dimension) => ({
      label: dimension.label,
      value: vector[dimension.key] ?? NEUTRAL_TASTE_VECTOR[dimension.key],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

export function buildTastePersonaSummary(vector: TasteVector): string {
  if (!hasTasteSignal(vector)) return TASTE_NOT_BUILT_SUMMARY;
  const top = topTasteLeans(vector, 2);
  if (top.length === 0) return "Your Taste Fingerprint is taking shape.";
  return `You lean ${top.map((entry) => entry.label.toLowerCase()).join(" and ")}.`;
}

export function buildTasteShareMessage(vector: TasteVector): string {
  const top = topTasteLeans(vector, 3).map(
    (entry) => `${entry.label} ${Math.round((entry.value / 10) * 100)}%`,
  );
  const traits = top.length > 0 ? `\n\nTop taste traits: ${top.join(", ")}` : "";
  return `Check out my Taste Fingerprint on Hungry!${traits}`;
}
