/** Empty is allowed (no score); anything else must be a whole number from 1 to 10. */
export function parseListItemScore(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Whole numbers only: the stored score is an integer, so 8.5 would be silently rounded.
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number.parseInt(trimmed, 10);
}

export function listItemScoreError(score: number | undefined): string | undefined {
  return score !== undefined && (Number.isNaN(score) || score < 1 || score > 10)
    ? "Use a whole number from 1 to 10."
    : undefined;
}
