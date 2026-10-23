import { TASTE_DIMENSIONS } from "@/constants/taste";
import type { TasteKey, TasteVector } from "@/types/domain";

/** A diner's taste value of 5 is neutral: the dish tastes the way its standard level says. */
const NEUTRAL = 5;
/** A diner at 0 (very sensitive) feels a dish twice as strong; at 10 (very tolerant) half as strong. */
const SENSITIVE_FACTOR = 2;
const TOLERANT_FACTOR = 0.5;
/** A difference smaller than this (on the 0-10 scale) still reads as "about the same". */
const SAME_THRESHOLD = 0.75;
/** Dishes weaker than this on an axis are not worth listing for that axis. */
const MIN_LISTED_LEVEL = 2;

export type PerceivedDirection = "stronger" | "same" | "milder";

export type PerceivedTasteRow = {
  key: TasteKey;
  label: string;
  /** The dish's standard level, 0-10, the same for every diner. */
  standard: number;
  /** The level this diner is likely to feel, 0-10. */
  perceived: number;
  direction: PerceivedDirection;
};

const clampLevel = (value: number) => Math.max(0, Math.min(10, value));

/**
 * How strong a dish feels to one diner. A 50% sweet drink is 5/10 for everyone, but a diner who
 * barely tolerates sugar (taste level 0) feels it as 10/10 and one who loves sweet (10) as 2.5/10.
 * `userLevel` is the diner's 0-10 value for that axis (how much heat/sweetness they enjoy and
 * handle): high means tolerant, low means sensitive.
 */
export function perceivedTasteLevel(standard: number, userLevel: number | undefined): number {
  const user = clampLevel(userLevel ?? NEUTRAL);
  const factor =
    user <= NEUTRAL
      ? 1 + ((NEUTRAL - user) / NEUTRAL) * (SENSITIVE_FACTOR - 1)
      : 1 - ((user - NEUTRAL) / NEUTRAL) * (1 - TOLERANT_FACTOR);
  return Math.round(clampLevel(standard * factor) * 10) / 10;
}

export function perceivedDirection(standard: number, perceived: number): PerceivedDirection {
  const difference = perceived - standard;
  if (Math.abs(difference) < SAME_THRESHOLD) return "same";
  return difference > 0 ? "stronger" : "milder";
}

/** Short words for a row: the numbers are an estimate, so the sentence leads. */
export function perceivedTasteSentence(row: PerceivedTasteRow): string {
  const axis = row.label.toLowerCase();
  if (row.direction === "stronger") return `Will taste more ${axis} to you than most people`;
  if (row.direction === "milder") return `Will taste less ${axis} to you than most people`;
  return `About as ${axis} as it is for most people`;
}

/** Axes this dish is noticeably strong on, strongest-for-you first. Empty for an untagged dish. */
export function perceivedTasteRows(
  dishVector: TasteVector | undefined,
  userVector: TasteVector | undefined,
): PerceivedTasteRow[] {
  if (!dishVector) return [];
  return TASTE_DIMENSIONS.map((dimension) => {
    const standard = clampLevel(dishVector[dimension.key] ?? 0);
    const perceived = perceivedTasteLevel(standard, userVector?.[dimension.key]);
    return {
      key: dimension.key,
      label: dimension.label,
      standard,
      perceived,
      direction: perceivedDirection(standard, perceived),
    };
  })
    .filter((row) => row.standard >= MIN_LISTED_LEVEL || row.perceived >= MIN_LISTED_LEVEL)
    .sort((a, b) => b.perceived - a.perceived)
    .slice(0, 4);
}

/** The diner's own palate as words: strongest likes first, for the Profile taste palette. */
export function palateSummary(vector: TasteVector | undefined): {
  loves: string[];
  mild: string[];
} {
  if (!vector) return { loves: [], mild: [] };
  const entries = TASTE_DIMENSIONS.map((dimension) => ({
    label: dimension.label,
    value: vector[dimension.key] ?? NEUTRAL,
  }));
  return {
    loves: entries
      .filter((entry) => entry.value >= 7)
      .sort((a, b) => b.value - a.value)
      .map((entry) => entry.label),
    mild: entries
      .filter((entry) => entry.value <= 3)
      .sort((a, b) => a.value - b.value)
      .map((entry) => entry.label),
  };
}

/** Every taste axis for the radar chart: the standard level, plus the diner's when they have a palette. */
export function perceivedTasteAxes(
  dishVector: TasteVector,
  userVector: TasteVector | undefined,
): { key: TasteKey; label: string; standard: number; perceived?: number }[] {
  return TASTE_DIMENSIONS.map((dimension) => {
    const standard = clampLevel(dishVector[dimension.key] ?? 0);
    return {
      key: dimension.key,
      label: dimension.label,
      standard,
      ...(userVector
        ? { perceived: perceivedTasteLevel(standard, userVector[dimension.key]) }
        : {}),
    };
  });
}
