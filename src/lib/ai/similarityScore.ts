import type { TasteVector } from "@/types/domain";

export function similarityScore(left: TasteVector, right: TasteVector): number {
  const keys = Object.keys(left) as (keyof TasteVector)[];
  const leftMagnitude = Math.sqrt(keys.reduce((sum, key) => sum + left[key] ** 2, 0));
  const rightMagnitude = Math.sqrt(keys.reduce((sum, key) => sum + right[key] ** 2, 0));
  const dot = keys.reduce((sum, key) => sum + left[key] * right[key], 0);

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (leftMagnitude * rightMagnitude);
}
