import type { DietaryFlag, MoodSearchIntent, TasteVector } from "@/types/domain";

const TASTE_AXES: (keyof TasteVector)[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];
const MAX_SHIFT = 5;

function toFiniteNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Reads the mood-search Edge Function's `intent`, dropping anything malformed. */
export function parseMoodIntent(raw: unknown): MoodSearchIntent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const shift = (row.tasteShift ?? {}) as Record<string, unknown>;
  const tasteShift = Object.fromEntries(
    TASTE_AXES.map((axis) => [
      axis,
      Math.min(MAX_SHIFT, Math.max(-MAX_SHIFT, toFiniteNumber(shift[axis]))),
    ]),
  ) as unknown as TasteVector;
  const maxPrice = toFiniteNumber(row.maxPrice);
  return {
    tasteShift,
    maxPrice: maxPrice > 0 ? maxPrice : undefined,
    dietaryFlags: Array.isArray(row.dietaryFlags)
      ? (row.dietaryFlags.filter((flag) => typeof flag === "string") as DietaryFlag[])
      : [],
    keywords: Array.isArray(row.keywords)
      ? row.keywords.filter((word): word is string => typeof word === "string" && word.length > 0)
      : [],
    summary: typeof row.summary === "string" ? row.summary : "",
  };
}
