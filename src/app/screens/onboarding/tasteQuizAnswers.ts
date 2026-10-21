import type { TasteKey, TasteVector } from "@/types/domain";

/** The three cards of every taste question, as the value each one saves. */
export const TASTE_ANSWER_OPTIONS = [2, 5, 8] as const;

/** The card a saved answer belongs to: the nearest of 2 / 5 / 8. */
export function nearestOptionIndex(value: number): number {
  let best = 0;
  TASTE_ANSWER_OPTIONS.forEach((option, index) => {
    if (Math.abs(option - value) < Math.abs(TASTE_ANSWER_OPTIONS[best]! - value)) best = index;
  });
  return best;
}

/**
 * Which card to centre and highlight: the saved answer for a question the user has
 * answered (or a retake's saved vector), otherwise the middle card with nothing
 * highlighted, so "Balanced" is never recorded for a question nobody answered.
 */
export function resolveQuestionCard(
  vector: TasteVector,
  key: TasteKey,
  answered: readonly TasteKey[],
): { scrollIndex: number; selectedIndex: number } {
  if (!answered.includes(key)) return { scrollIndex: 1, selectedIndex: -1 };
  const index = nearestOptionIndex(vector[key]);
  return { scrollIndex: index, selectedIndex: index };
}

/** A quiz where no question was answered counts as skipped, not as an all-balanced taste. */
export function hasAnsweredAnyQuestion(answered: readonly TasteKey[]): boolean {
  return answered.length > 0;
}
