import type {
  DietaryFlag,
  DishDetail,
  MoodSearchIntent,
  SearchFilters,
  TasteVector,
} from "@/types/domain";

const TASTE_AXES: (keyof TasteVector)[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];
const MAX_SHIFT = 5;

function toFiniteNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** A typed sentence (two or more words) that found no dish by name is worth a mood search. */
export function shouldTryMoodSearch(query: string, nameMatchCount: number): boolean {
  return nameMatchCount === 0 && query.trim().split(/\s+/).length >= 2;
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

/** The person's usual taste moved by the mood, plus the mood's budget and dietary needs. */
export function applyMoodIntent(
  filters: SearchFilters,
  tasteVector: TasteVector,
  intent: MoodSearchIntent,
): { filters: SearchFilters; tasteVector: TasteVector } {
  const shifted = Object.fromEntries(
    TASTE_AXES.map((axis) => [
      axis,
      Math.min(10, Math.max(0, tasteVector[axis] + intent.tasteShift[axis])),
    ]),
  ) as unknown as TasteVector;
  return {
    filters: {
      ...filters,
      // The sentence itself won't match dish names; ranking comes from taste and keywords.
      query: "",
      tasteValues: shifted,
      dietaryFlags: [...new Set([...filters.dietaryFlags, ...intent.dietaryFlags])],
      maxPrice: intent.maxPrice ?? filters.maxPrice,
    },
    tasteVector: shifted,
  };
}

/** Keeps taste order, but lifts dishes whose name or tags mention a keyword, and enforces the budget. */
export function rankMoodResults(results: DishDetail[], intent: MoodSearchIntent): DishDetail[] {
  const affordable =
    intent.maxPrice === undefined
      ? results
      : results.filter((dish) => dish.price <= (intent.maxPrice as number));
  if (intent.keywords.length === 0) return affordable;
  const mentionsKeyword = (dish: DishDetail) => {
    const text = `${dish.name} ${dish.tasteTags.join(" ")} ${dish.foodTypeTag ?? ""}`.toLowerCase();
    return intent.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  };
  return [
    ...affordable.filter(mentionsKeyword),
    ...affordable.filter((dish) => !mentionsKeyword(dish)),
  ];
}
